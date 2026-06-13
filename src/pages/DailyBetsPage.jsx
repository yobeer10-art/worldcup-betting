import { useCallback, useEffect, useState } from 'react'
import { useAuth }         from '../context/AuthContext'
import { supabase }        from '../lib/supabase'
import Header              from '../components/Layout/Header'
import CompactMatchCard    from '../components/Matches/CompactMatchCard'
import Spinner             from '../components/UI/Spinner'

/* ── Israel date helpers ──────────────────────────────────────── */
function israelToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function hebrewDateLabel(dateStr) {
  return new Date(`${dateStr}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long', day: 'numeric', month: 'long',
  })
}
function hebrewShortDate(dateStr) {
  return new Date(`${dateStr}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

/* ── 2-column match grid ──────────────────────────────────────── */
function MatchGrid({ matches, userBets, stats, today, onBetPlaced }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {matches.map(m => (
        <CompactMatchCard
          key={m.id}
          match={m}
          userBet={userBets[m.id] ?? null}
          communityStats={stats[m.id] ?? null}
          onBetPlaced={onBetPlaced}
          isToday={israelDate(m.match_date) === today}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
export default function DailyBetsPage() {
  const { user } = useAuth()

  const [allMatches, setAllMatches] = useState([])
  const [userBets,   setUserBets]   = useState({})
  const [stats,      setStats]      = useState({})
  const [loading,    setLoading]    = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Fetch ALL matches
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true })

    const matches = matchData ?? []
    setAllMatches(matches)

    const ids = matches.map(m => m.id)

    const [statsRes, betsRes] = await Promise.all([
      ids.length
        ? supabase.from('bet_stats').select('*').in('match_id', ids)
        : Promise.resolve({ data: [] }),
      user && ids.length
        ? supabase.from('bets').select('*').eq('user_id', user.id).in('match_id', ids)
        : Promise.resolve({ data: [] }),
    ])

    const sm = {}
    statsRes.data?.forEach(s => { sm[s.match_id] = s })
    setStats(sm)

    const bm = {}
    betsRes.data?.forEach(b => { bm[b.match_id] = b })
    setUserBets(bm)

    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Split matches into sections ─────────────────────────── */
  const today    = israelToday()

  const todayMatches    = allMatches.filter(m => israelDate(m.match_date) === today)
  const upcomingMatches = allMatches.filter(m => israelDate(m.match_date) > today && m.status !== 'finished')
  const finishedMatches = allMatches.filter(m => m.status === 'finished' && israelDate(m.match_date) !== today)

  // Group upcoming by date
  const upcomingByDate = {}
  for (const m of upcomingMatches) {
    const d = israelDate(m.match_date)
    if (!upcomingByDate[d]) upcomingByDate[d] = []
    upcomingByDate[d].push(m)
  }
  const upcomingDates = Object.keys(upcomingByDate).sort()

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-3 py-4 pb-24 space-y-6">

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : allMatches.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="text-5xl">⚽</div>
            <p className="text-slate-500 font-semibold">אין משחקים בקרוב</p>
          </div>
        ) : (
          <>
            {/* ── TODAY ──────────────────────────────────────── */}
            {todayMatches.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-emerald-200" />
                  <div className="flex items-center gap-2 bg-emerald-500 text-white
                                  text-xs font-extrabold px-3 py-1 rounded-full shadow-sm shadow-emerald-300/50">
                    <span className="animate-pulse">🟢</span>
                    <span>משחקי היום · {hebrewDateLabel(today)}</span>
                  </div>
                  <div className="flex-1 h-px bg-emerald-200" />
                </div>
                <MatchGrid
                  matches={todayMatches}
                  userBets={userBets}
                  stats={stats}
                  today={today}
                  onBetPlaced={fetchData}
                />
              </section>
            )}

            {/* ── No matches today banner ─────────────────────── */}
            {todayMatches.length === 0 && upcomingDates.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs text-amber-700 font-medium">
                  אין משחקים היום — המשחקים הבאים:
                </p>
              </div>
            )}

            {/* ── UPCOMING (grouped by date) ──────────────────── */}
            {upcomingDates.map(dateStr => (
              <section key={dateStr}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-bold text-slate-500 bg-slate-100
                                   px-2.5 py-1 rounded-full">
                    📅 {hebrewShortDate(dateStr)}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <MatchGrid
                  matches={upcomingByDate[dateStr]}
                  userBets={userBets}
                  stats={stats}
                  today={today}
                  onBetPlaced={fetchData}
                />
              </section>
            ))}

            {/* ── FINISHED ───────────────────────────────────── */}
            {finishedMatches.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-bold text-slate-400 bg-slate-100
                                   px-2.5 py-1 rounded-full">
                    ✅ שנגמרו ({finishedMatches.length})
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <MatchGrid
                  matches={[...finishedMatches].reverse()}
                  userBets={userBets}
                  stats={stats}
                  today={today}
                  onBetPlaced={fetchData}
                />
              </section>
            )}
          </>
        )}

      </main>
    </>
  )
}
