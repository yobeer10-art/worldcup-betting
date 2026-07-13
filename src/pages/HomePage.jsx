import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'
import CompactMatchCard from '../components/Matches/CompactMatchCard'
import FlagImg from '../components/UI/FlagImg'
import Spinner from '../components/UI/Spinner'

const KO_STAGES = new Set(['round_of_32','round_of_16','quarter','semi','third_place','final'])

const STAGE_LABEL = {
  quarter: 'רבע הגמר', semi: 'חצי הגמר', third_place: 'מקום שלישי', final: 'הגמר הגדול',
}

/* ── Live countdown row ──────────────────────────────────────── */
function Countdown({ target }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const ms = new Date(target).getTime() - now
  if (ms <= 0) return null

  const days  = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins  = Math.floor((ms % 3_600_000) / 60_000)
  const secs  = Math.floor((ms % 60_000) / 1000)

  return (
    <div className="flex justify-center gap-2" dir="ltr">
      {[
        { v: days,  l: 'ימים'  },
        { v: hours, l: 'שעות'  },
        { v: mins,  l: 'דקות'  },
        { v: secs,  l: 'שניות' },
      ].map(({ v, l }) => (
        <div key={l} className="bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-1.5 min-w-[52px] text-center">
          <div className="text-xl font-black tabular-nums leading-none">{String(v).padStart(2, '0')}</div>
          <div className="text-[9px] text-white/60 font-semibold mt-0.5">{l}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Unified knockout hub: hype + countdown + betting in one ─── */
function KnockoutHub({ bigMatches, userBets, stats, onBetPlaced, champion, scorer, user }) {
  const nextUp  = bigMatches.find(m => m.status === 'upcoming' && new Date(m.match_date).getTime() > Date.now())
  const isFinal = bigMatches.some(m => m.stage === 'final')
  const stageLabel = isFinal ? 'הגמר הגדול' : STAGE_LABEL[bigMatches[0]?.stage] ?? 'נוקאאוט'
  const unbetCount = bigMatches.filter(m =>
    m.status === 'upcoming' && !userBets[m.id]?.advance_pick
  ).length

  // Teams still in the title race: SF participants, minus SF losers once decided
  const aliveTeams = new Set()
  bigMatches.filter(m => m.stage === 'semi').forEach(m => {
    if (m.status === 'finished' && m.result) {
      aliveTeams.add(m.result === 'home' ? m.home_team : m.away_team)
    } else {
      aliveTeams.add(m.home_team)
      aliveTeams.add(m.away_team)
    }
  })
  bigMatches.filter(m => m.stage === 'final').forEach(m => {
    if (m.status === 'finished' && m.result) {
      aliveTeams.clear()
      aliveTeams.add(m.result === 'home' ? m.home_team : m.away_team)
    }
  })
  const champAlive = champion != null && aliveTeams.size > 0 && aliveTeams.has(champion)

  // Tournament progress: 104 total matches; remaining = unfinished among SF/3rd/Final
  // (3rd place + final rows may not exist yet — count them as remaining anyway)
  const bigFinished  = bigMatches.filter(m => m.status === 'finished').length
  const playedTotal  = 100 + bigFinished
  const progressPct  = Math.round((playedTotal / 104) * 100)

  return (
    <div className={`relative overflow-hidden rounded-3xl shadow-xl ${
      isFinal
        ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600'
        : 'bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700'
    }`}>
      {/* Decorative glows */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-14 -right-10 w-44 h-44 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-4 pb-3 text-white">
        {/* Title */}
        <div className="text-center mb-1">
          <p className="text-[11px] font-extrabold tracking-[0.25em] uppercase text-white/60">
            {isFinal ? '🏆 מונדיאל 2026 🏆' : '⚡ מונדיאל 2026 ⚡'}
          </p>
          <h2 className="text-2xl font-black leading-tight mt-0.5">
            {stageLabel} כאן!
          </h2>
          <p className="text-[12px] text-white/80 font-semibold mt-1">
            {isFinal
              ? 'משחק אחד. גביע אחד. ההימור הכי חשוב שלך.'
              : '4 נבחרות. 2 כרטיסים לגמר. ההימור שלך על הפרק.'}
          </p>
        </div>

        {/* Boosted points banner */}
        <div className="flex items-center justify-center gap-2 my-3">
          <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-extrabold">
            ⚡ עולה לגמר = <span className="text-amber-300">3 נק׳</span>
          </span>
          <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-extrabold">
            🎯 תוצאה מדויקת = <span className="text-amber-300">5 נק׳</span>
          </span>
        </div>

        {/* Final-stretch progress bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center text-[10px] font-bold mb-1">
            <span className="text-amber-300">🏁 הישורת האחרונה של המונדיאל</span>
            <span className="text-white/60 tabular-nums">{playedTotal}/104 משחקים</span>
          </div>
          <div className="h-2 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Countdown to next kickoff */}
        {nextUp && (
          <div className="mb-1">
            <p className="text-center text-[10px] text-white/60 font-bold mb-1.5">
              המשחק הקרוב: {nextUp.home_team} נגד {nextUp.away_team}
            </p>
            <Countdown target={nextUp.match_date} />
          </div>
        )}

        {/* Urgency nudge */}
        {unbetCount > 0 && (
          <p className="text-center text-[12px] font-extrabold text-amber-300 mt-3 animate-pulse">
            🔥 {unbetCount === 1 ? 'משחק אחד עוד מחכה להימור שלך' : `${unbetCount} משחקים עוד מחכים להימור שלך`} — אל תפספס!
          </p>
        )}
        {unbetCount === 0 && bigMatches.some(m => m.status === 'upcoming') && (
          <p className="text-center text-[12px] font-extrabold text-emerald-300 mt-3">
            ✅ כל ההימורים שלך בפנים — בהצלחה!
          </p>
        )}
      </div>

      {/* Betting cards embedded */}
      <div className="relative px-3 pb-3 space-y-3">
        {bigMatches.map(m => (
          <CompactMatchCard
            key={m.id}
            match={m}
            userBet={userBets[m.id] ?? null}
            communityStats={stats[m.id] ?? null}
            onBetPlaced={onBetPlaced}
            isToday
          />
        ))}
      </div>

      {/* Grand bets: champion + top scorer, right here in the party */}
      {user && (
        <div className="relative px-3 pb-4">
          <p className="text-center text-[10px] font-extrabold tracking-widest uppercase text-white/50 mb-2">
            — ההימורים הגדולים שלך · 25 נק׳ כל אחד —
          </p>
          <div className="grid grid-cols-2 gap-2">

            {/* Champion pick */}
            <Link
              to="/special?t=champion"
              className={`rounded-2xl p-3 border-2 backdrop-blur-sm transition-all ${
                champion
                  ? champAlive
                    ? 'bg-gradient-to-br from-amber-400/25 to-yellow-500/15 border-amber-300/60'
                    : 'bg-white/5 border-white/15 opacity-80'
                  : 'bg-white/10 border-dashed border-white/30 hover:bg-white/15'
              }`}
            >
              <p className="text-[9px] font-extrabold text-white/60 uppercase tracking-wide mb-1.5">
                🥇 האלופה שלך
              </p>
              {champion ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <FlagImg team={champion} size="sm" />
                    <span className="text-xs font-black text-white truncate">{champion}</span>
                  </div>
                  <p className={`text-[10px] font-extrabold mt-1.5 ${
                    champAlive ? 'text-amber-300 animate-pulse' : 'text-white/40'
                  }`}>
                    {champAlive ? '🔥 עדיין במירוץ לגביע!' : '💔 הודחה מהמירוץ'}
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-amber-300">עוד לא בחרת →</p>
              )}
            </Link>

            {/* Top scorer pick */}
            <Link
              to="/special?t=scorer"
              className={`rounded-2xl p-3 border-2 backdrop-blur-sm transition-all ${
                scorer
                  ? 'bg-gradient-to-br from-sky-400/25 to-cyan-500/15 border-sky-300/50'
                  : 'bg-white/10 border-dashed border-white/30 hover:bg-white/15'
              }`}
            >
              <p className="text-[9px] font-extrabold text-white/60 uppercase tracking-wide mb-1.5">
                ⚽ מלך השערים שלך
              </p>
              {scorer ? (
                <>
                  <span className="text-xs font-black text-white leading-snug line-clamp-2">{scorer}</span>
                  <p className="text-[10px] font-extrabold text-sky-300 mt-1.5">🎯 בתקווה שיכבוש בגמר!</p>
                </>
              ) : (
                <p className="text-xs font-bold text-sky-300">עוד לא בחרת →</p>
              )}
            </Link>

          </div>
        </div>
      )}
    </div>
  )
}

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
  const [bigKoMatches, setBigKoMatches] = useState([])
  const [userBets,   setUserBets]   = useState({})
  const [stats,      setStats]      = useState({})
  const [rank,       setRank]       = useState(null)
  const [koPts,      setKoPts]      = useState(null)
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

    // ── Big KO matches (SF / 3rd / Final) — always fetched, all days ──
    const { data: bigData } = await supabase
      .from('matches').select('*')
      .in('stage', ['semi', 'third_place', 'final'])
      .order('match_date')
    setBigKoMatches(bigData ?? [])

    // ── Parallel fetches ─────────────────────────────────────────
    const idSet = new Set([
      ...(dayMatches ?? []).map(m => m.id),
      ...(bigData ?? []).map(m => m.id),
    ])
    const ids = [...idSet]
    const [statsRes, totalRes, betsRes, koLbRes, champRes, scorerRes] =
      await Promise.all([
        ids.length
          ? supabase.from('bet_stats').select('*').in('match_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        user && ids.length
          ? supabase.from('bets').select('*').eq('user_id', user.id).in('match_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.rpc('knockout_leaderboard'),
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

    // Knockout leaderboard: hero shows KO points + KO rank (not the overall table)
    if (user && koLbRes.data?.length) {
      const koList = koLbRes.data
      const idx = koList.findIndex(r => r.user_id === user.id)
      if (idx >= 0) {
        setKoPts(Number(koList[idx].knockout_points ?? 0))
        setRank(idx + 1)
      }
    }
    setChampion(champRes.data?.team ?? null)
    setScorer(scorerRes.data?.player_name ?? null)

    setLoading(false)
  }, [user, profile?.total_points])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Big KO matches (SF / 3rd place / Final) get the unified hub treatment.
  // Hub shows upcoming/live plus recently finished (until the next stage starts).
  const bigMatches   = bigKoMatches
  const otherMatches = matches.filter(m => !['semi', 'third_place', 'final'].includes(m.stage))

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-6">

        {/* ── Hero / stats ───────────────────────────────────── */}
        {user ? (
          <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600
                          rounded-2xl p-5 text-white shadow-md">
            <p className="text-emerald-100 text-sm mb-1">
              שלום, <span className="font-bold">{profile?.display_name || 'שחקן'}</span> 👋
            </p>
            {bigMatches.length > 0 && (
              <p className="text-[11px] text-amber-200 font-extrabold mb-3">
                🏆 הישורת האחרונה — כל נקודה שווה זהב!
              </p>
            )}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tabular-nums leading-none">
                    {koPts ?? profile?.total_points ?? 0}
                  </span>
                  <span className="text-emerald-200 text-base">
                    {koPts != null ? 'נק׳ נוקאאוט' : 'נקודות'}
                  </span>
                </div>
              </div>
              {rank && (
                <div className="text-right">
                  <div className="text-2xl font-extrabold">#{rank}</div>
                  <p className="text-emerald-200 text-xs">
                    {koPts != null ? `בטבלת הנוקאאוט · ${totalUsers} שחקנים` : `מתוך ${totalUsers} שחקנים`}
                  </p>
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

        {/* ── Unified knockout hub (SF / Final: hype + betting) ── */}
        {!loading && bigMatches.length > 0 && (
          <KnockoutHub
            bigMatches={bigMatches}
            userBets={userBets}
            stats={stats}
            onBetPlaced={fetchAll}
            champion={champion}
            scorer={scorer}
            user={user}
          />
        )}

        {/* ── Smart next-bet nudge (hidden when hub is showing — it has its own) ── */}
        {user && !loading && bigMatches.length === 0 && (() => {
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

        {/* ── Today's / next matches (big KO matches live in the hub above) ── */}
        {(loading || bigMatches.length === 0 || otherMatches.length > 0) && (
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
            ) : otherMatches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                <div className="text-3xl mb-2">🏆</div>
                <p className="text-slate-500 text-sm font-medium">אין משחקים בתקופה הקרובה</p>
              </div>
            ) : (
              <div className="space-y-4">
                {otherMatches.map(m => (
                  KO_STAGES.has(m.stage)
                    ? <CompactMatchCard
                        key={m.id}
                        match={m}
                        userBet={userBets[m.id] ?? null}
                        communityStats={stats[m.id] ?? null}
                        onBetPlaced={fetchAll}
                        isToday={!isNext}
                      />
                    : <MatchCard
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
        )}

        {/* ── Special bets quick status (hidden when hub shows them) ── */}
        {bigMatches.length === 0 && (
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
        )}

      </main>
    </>
  )
}
