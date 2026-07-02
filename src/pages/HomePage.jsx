import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'
import FlagImg from '../components/UI/FlagImg'
import Spinner from '../components/UI/Spinner'

/* ── Date helpers (Israel time) ──────────────────────────────── */
function israelToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelDayRange(d) {
  return {
    start: new Date(`${d}T00:00:00+03:00`),
    end:   new Date(`${d}T23:59:59+03:00`),
  }
}
function hebrewDateShort(dateStr) {
  return new Date(`${dateStr}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', weekday: 'short',
  })
}

/* ════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const { user, profile } = useAuth()

  const [matches,    setMatches]    = useState([])
  const [userBets,   setUserBets]   = useState({})
  const [stats,      setStats]      = useState({})
  const [rank,       setRank]       = useState(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [champion,   setChampion]   = useState(null)
  const [scorer,     setScorer]     = useState(null)
  const [dateStr,    setDateStr]    = useState(israelToday)
  const [isNext,     setIsNext]     = useState(false)
  const [loading,    setLoading]    = useState(true)

  const fetchAll = useCallback(async () => {
    const today = israelToday()
    const { start, end } = israelDayRange(today)

    // ── Today's matches ─────────────────────────────────────────
    let { data: dayMatches } = await supabase
      .from('matches').select('*')
      .gte('match_date', start.toISOString())
      .lte('match_date', end.toISOString())
      .order('match_date')

    let usedDate = today
    let next = false

    if (!dayMatches?.length) {
      const { data: up } = await supabase
        .from('matches').select('match_date')
        .gt('match_date', end.toISOString())
        .order('match_date').limit(1)

      if (up?.length) {
        usedDate = new Date(up[0].match_date)
          .toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
        const { start: ns, end: ne } = israelDayRange(usedDate)
        const { data: nm } = await supabase
          .from('matches').select('*')
          .gte('match_date', ns.toISOString())
          .lte('match_date', ne.toISOString())
          .order('match_date')
        dayMatches = nm ?? []
        next = true
      }
    }

    setMatches(dayMatches ?? [])
    setDateStr(usedDate)
    setIsNext(next)

    // ── Parallel fetches ─────────────────────────────────────────
    const ids = (dayMatches ?? []).map(m => m.id)
    const [statsRes, totalRes, betsRes, rankRes, champRes, scorerRes] =
      await Promise.all([
        ids.length
          ? supabase.from('bet_stats').select('*').in('match_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        user && ids.length
          ? supabase.from('bets').select('match_id').eq('user_id', user.id).in('match_id', ids)
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from('users').select('id', { count: 'exact', head: true })
              .gt('total_points', profile?.total_points ?? -1)
          : Promise.resolve({ count: null }),
        user
          ? supabase.from('champion_predictions').select('team')
              .eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('top_scorer_predictions').select('player_name')
              .eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

    const sm = {}
    statsRes.data?.forEach(s => { sm[s.match_id] = s })
    setStats(sm)

    setTotalUsers(totalRes.count ?? 0)

    const bm = {}
    betsRes.data?.forEach(b => { bm[b.match_id] = b })
    setUserBets(bm)

    if (rankRes.count != null) setRank(rankRes.count + 1)
    setChampion(champRes.data?.team ?? null)
    setScorer(scorerRes.data?.player_name ?? null)

    setLoading(false)
  }, [user, profile?.total_points])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-6">

        {/* ── Hero / stats ───────────────────────────────────── */}
        {user ? (
          <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600
                          rounded-2xl p-5 text-white shadow-md">
            <p className="text-emerald-100 text-sm mb-3">
              שלום, <span className="font-bold">{profile?.display_name || 'שחקן'}</span> 👋
            </p>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tabular-nums leading-none">
                    {profile?.total_points ?? 0}
                  </span>
                  <span className="text-emerald-200 text-base">נקודות</span>
                </div>
              </div>
              {rank && (
                <div className="text-right">
                  <div className="text-2xl font-extrabold">#{rank}</div>
                  <p className="text-emerald-200 text-xs">מתוך {totalUsers} שחקנים</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600
                          rounded-2xl p-5 text-white shadow-md">
            <div className="text-2xl font-extrabold mb-1">ברוכים הבאים! ⚽</div>
            <p className="text-emerald-100 text-sm mb-4">
              נחש תוצאות, בחר אלופה ומלך שערים — עלה בדירוג
            </p>
            <Link
              to="/auth"
              className="inline-block bg-white text-emerald-700 px-5 py-2.5 rounded-xl
                         font-bold text-sm hover:bg-emerald-50 transition-colors shadow-sm"
            >
              הצטרף בחינם
            </Link>
          </div>
        )}

        {/* ── Smart next-bet nudge ──────────────────────────── */}
        {user && !loading && (() => {
          const now = Date.now()
          const nextUnbet = matches.find(m =>
            m.status === 'upcoming' &&
            !userBets[m.id] &&
            new Date(m.match_date).getTime() - now > 5 * 60_000 &&
            !m.is_locked
          )
          if (!nextUnbet) {
            const hasBettable = matches.some(m => m.status === 'upcoming')
            if (!hasBettable) return null
            return (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                <span className="text-xl">✅</span>
                <p className="text-sm font-bold text-emerald-700">כל ההימורים לסבב הזה הוגשו!</p>
              </div>
            )
          }
          const minsLeft = Math.floor((new Date(nextUnbet.match_date).getTime() - now) / 60_000)
          const urgent = minsLeft <= 30
          return (
            <Link
              to="/matches"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all shadow-sm ${
                urgent
                  ? 'bg-rose-50 border-rose-200 hover:border-rose-300'
                  : 'bg-amber-50 border-amber-200 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl flex-shrink-0">{urgent ? '🔥' : '⚽'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-extrabold ${urgent ? 'text-rose-700' : 'text-amber-700'}`}>
                  {urgent ? `נסגר בעוד ${minsLeft} דקות!` : 'עוד לא הימרת'}
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {nextUnbet.home_team} נגד {nextUnbet.away_team}
                </p>
              </div>
              <span className={`text-xs font-bold flex-shrink-0 ${urgent ? 'text-rose-500' : 'text-amber-500'}`}>
                הימר ←
              </span>
            </Link>
          )
        })()}

        {/* ── Today's / next matches ──────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-slate-800">
              {isNext ? '⚽ משחקים קרובים' : `⚽ משחקי היום · ${hebrewDateShort(dateStr)}`}
            </h2>
            <Link to="/matches" className="text-xs text-emerald-600 font-semibold hover:underline">
              כל המשחקים ←
            </Link>
          </div>

          {loading ? (
            <Spinner size="sm" />
          ) : matches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <div className="text-3xl mb-2">🏆</div>
              <p className="text-slate-500 text-sm font-medium">אין משחקים בתקופה הקרובה</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map(m => (
                <MatchCard
                  key={m.id}
                  match={m}
                  userBet={userBets[m.id] ?? null}
                  communityStats={stats[m.id] ?? null}
                  onBetPlaced={fetchAll}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Special bets quick status ───────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-slate-800">🏆 ניחושים מיוחדים</h2>
            <Link to="/special" className="text-xs text-emerald-600 font-semibold hover:underline">
              ערוך ←
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">

            {/* Champion card */}
            <Link
              to="/special?t=champion"
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm
                         hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                🥇 אלופה · 25 נק׳
              </p>
              {champion ? (
                <div className="flex items-center gap-2">
                  <FlagImg team={champion} size="sm" className="shrink-0" />
                  <span className="text-sm font-bold text-slate-800 truncate">{champion}</span>
                </div>
              ) : (
                <p className="text-sm text-amber-600 font-bold group-hover:text-amber-700">
                  לחץ לבחור →
                </p>
              )}
            </Link>

            {/* Top scorer card */}
            <Link
              to="/special?t=scorer"
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm
                         hover:border-sky-300 hover:shadow-md transition-all group"
            >
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                ⚽ מלך שערים · 25 נק׳
              </p>
              {scorer ? (
                <span className="text-sm font-bold text-slate-800 leading-snug">{scorer}</span>
              ) : (
                <p className="text-sm text-sky-600 font-bold group-hover:text-sky-700">
                  לחץ לבחור →
                </p>
              )}
            </Link>

          </div>
        </section>

      </main>
    </>
  )
}
