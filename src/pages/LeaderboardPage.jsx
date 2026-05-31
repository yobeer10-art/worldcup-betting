import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import LeaderboardTable from '../components/Leaderboard/LeaderboardTable'

export default function LeaderboardPage() {
  const { user, profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data } = await supabase
        .from('users')
        .select('id, display_name, total_points')
        .order('total_points', { ascending: false })
        .order('display_name', { ascending: true })
      setUsers(data ?? [])
      setLoading(false)
    }
    fetchLeaderboard()
  }, [])

  const myRank = users.findIndex((u) => u.id === user?.id) + 1

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏆</span>
          <h1 className="text-2xl font-bold text-gray-800">טבלת מובילים</h1>
        </div>

        {/* Current user banner */}
        {user && profile && myRank > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-5 flex items-center justify-between">
            <span className="text-sm text-green-700">
              המיקום שלך:{' '}
              <strong className="text-lg">#{myRank}</strong>
            </span>
            <span className="text-sm text-green-700">
              נקודות:{' '}
              <strong className="text-lg text-green-600">{profile.total_points}</strong>
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <LeaderboardTable users={users} currentUserId={user?.id} />
        )}
      </main>
    </>
  )
}
