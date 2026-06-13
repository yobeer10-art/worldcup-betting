import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'
import Spinner from '../components/UI/Spinner'

/* ── Date helpers (Israel timezone) ─────────────────────────── */
function israelToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}

function israelDayRange(dateStr) {
  return {
    start: new Date(`${dateStr}T00:00:00+03:00`),
    end:   new Date(`${dateStr}T23:59:59+03:00`),
  }
}

function hebrewDateLabel(dateStr) {
  return new Date(`${dateStr}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/* ═══════════════════════════════════════════════════════════════ */
export default function DailyBetsPage() {
  const { user } = useAuth()

  const [matches,  setMatches]  = useState([])
  const [userBets, setUserBets] = useState({})
  const [stats,    setStats]    = useState({})
  const [loading,  setLoading]  = useState(true)
  const [dateStr,  setDateStr]  = useState(israelToday)   // YYYY-MM-DD
  const [isNext,   setIsNext]   = useState(false)         // showing a future day

  const fetchData = useCallback(async () => {
    setLoading(true)

    const today = israelToday()
    const { start, end } = israelDayRange(today)

    // Try today first
    let { data: dayMatches } = await supabase
      .from('matches')
      .select('*')
      .gte('match_date', start.toISOString())
      .lte('match_date', end.toISOString())
      .order('match_date')

    let usedDate = today
    let next     = false

    // If today is empty, jump to the next day that has matches
    if (!dayMatches?.length) {
      const { data: upcoming } = await supabase
        .from('matches')
        .select('match_date')
        .gt('match_date', end.toISOString())
        .order('match_date')
        .limit(1)

      if (upcoming?.length) {
        usedDate = new Date(upcoming[0].match_date)
          .toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
        const { start: ns, end: ne } = israelDayRange(usedDate)
        const { data: nm } = await supabase
          .from('matches')
          .select('*')
          .gte('match_date', ns.toISOString())
          .lte('match_date', ne.toISOString())
          .order('match_date')
        dayMatches = nm ?? []
        next       = true
      } else {
        dayMatches = []
      }
    }

    setMatches(dayMatches)
    setDateStr(usedDate)
    setIsNext(next)

    const ids = dayMatches.map(m => m.id)

    // Fetch community stats + user bets in parallel
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

  const label = hebrewDateLabel(dateStr)

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5 pb-24">

        {/* Date header */}
        <div className="mb-5">
          {isNext ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3 text-center">
              <p className="text-xs text-amber-700 font-medium">אין משחקים היום — המשחקים הבאים:</p>
            </div>
          ) : null}
          <h1 className="text-lg font-extrabold text-slate-800">
            ⚽ {label}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isNext ? 'משחקים קרובים' : 'הימורי היום — ננעל 5 דקות לפני כל משחק'}
          </p>
        </div>

        {loading ? (
          <Spinner />
        ) : matches.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="text-5xl">🏆</div>
            <p className="text-slate-500 font-semibold">אין משחקים בתקופה הקרובה</p>
            <p className="text-slate-400 text-sm">נשוב לאחר הסיבוב הבא</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                userBet={userBets[m.id] ?? null}
                communityStats={stats[m.id] ?? null}
                onBetPlaced={fetchData}
              />
            ))}
          </div>
        )}

      </main>
    </>
  )
}
