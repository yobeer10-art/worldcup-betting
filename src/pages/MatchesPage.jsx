import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'
import Spinner from '../components/UI/Spinner'

const FILTERS = [
  { id: 'all',      label: 'הכל',       icon: '📋' },
  { id: 'upcoming', label: 'קרובים',    icon: '⏳' },
  { id: 'live',     label: 'עכשיו',     icon: '🔴' },
  { id: 'finished', label: 'שנגמרו',   icon: '✅' },
]

export default function MatchesPage() {
  const { user } = useAuth()
  const [matches, setMatches]   = useState([])
  const [userBets, setUserBets] = useState({})
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')

  const fetchData = useCallback(async () => {
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true })

    setMatches(matchData ?? [])

    if (user) {
      const { data: betsData } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
      const map = {}
      betsData?.forEach((b) => { map[b.match_id] = b })
      setUserBets(map)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const visible = filter === 'all' ? matches : matches.filter((m) => m.status === filter)

  // counts for badges
  const counts = matches.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5">

        {/* Page title */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⚽</span>
          <h1 className="text-2xl font-extrabold text-slate-800">כל המשחקים</h1>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(({ id, label, icon }) => {
            const count = id === 'all' ? matches.length : (counts[id] ?? 0)
            const active = filter === id
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  active
                    ? 'bg-green-600 text-white shadow-md shadow-green-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-green-300 hover:text-green-700 shadow-sm'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                {count > 0 && (
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                      active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Matches */}
        {loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📅</div>
            <p className="font-medium">אין משחקים בקטגוריה זו</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                userBet={userBets[match.id]}
                onBetPlaced={fetchData}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
