import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'

const FILTERS = [
  { id: 'all', label: 'הכל' },
  { id: 'upcoming', label: 'קרובים' },
  { id: 'live', label: 'עכשיו' },
  { id: 'finished', label: 'שנגמרו' },
]

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function MatchesPage() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [userBets, setUserBets] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

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

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">משחקים</h1>

        {/* Filter pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                filter === id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm">אין משחקים בקטגוריה זו</p>
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
