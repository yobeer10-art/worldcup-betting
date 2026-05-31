import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function HomePage() {
  const { user, profile } = useAuth()
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [userBets, setUserBets] = useState({})
  const [stats, setStats] = useState({ totalUsers: 0, totalBets: 0 })
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const [matchesRes, usersRes, betsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .eq('status', 'upcoming')
        .gte('match_date', new Date().toISOString())
        .order('match_date', { ascending: true })
        .limit(3),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('bets').select('id', { count: 'exact', head: true }),
    ])

    setUpcomingMatches(matchesRes.data ?? [])
    setStats({ totalUsers: usersRes.count ?? 0, totalBets: betsRes.count ?? 0 })

    if (user) {
      const { data: myBets } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
      const map = {}
      myBets?.forEach((b) => { map[b.match_id] = b })
      setUserBets(map)
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Hero banner */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-extrabold">מונדיאל 2026 🏆</h1>
              <p className="text-green-100 text-sm mt-1">
                ארה"ב · קנדה · מקסיקו
              </p>
            </div>
            <span className="text-5xl">⚽</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBox value={stats.totalUsers} label="משתתפים" />
            <StatBox value={stats.totalBets} label="ניחושים" />
            {user && profile ? (
              <StatBox value={profile.total_points} label="הנקודות שלי" highlight />
            ) : (
              <StatBox value="—" label="הנקודות שלי" />
            )}
          </div>
        </div>

        {/* CTA for guests */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-amber-800 text-sm">
              הצטרף ותתחיל לנחש תוצאות!
            </p>
            <Link
              to="/auth"
              className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              הרשמה חינם
            </Link>
          </div>
        )}

        {/* Upcoming matches */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">משחקים קרובים</h2>
          <Link to="/matches" className="text-sm text-green-600 hover:underline">
            כל המשחקים ←
          </Link>
        </div>

        {loading ? (
          <Spinner />
        ) : upcomingMatches.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm">אין משחקים קרובים</p>
            <Link to="/matches" className="text-green-600 text-sm mt-2 block hover:underline">
              צפה בכל המשחקים
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingMatches.map((match) => (
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

function StatBox({ value, label, highlight }) {
  return (
    <div className="bg-white/20 rounded-xl px-3 py-2.5 text-center">
      <div className={`text-2xl font-extrabold tabular-nums ${highlight ? 'text-yellow-300' : ''}`}>
        {value}
      </div>
      <div className="text-xs text-green-100 mt-0.5">{label}</div>
    </div>
  )
}
