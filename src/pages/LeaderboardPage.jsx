import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import LeaderboardTable from '../components/Leaderboard/LeaderboardTable'
import Spinner from '../components/UI/Spinner'

export default function LeaderboardPage() {
  const { user, profile } = useAuth()
  const [users, setUsers]   = useState([])
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

  const myRank    = users.findIndex((u) => u.id === user?.id) + 1
  const totalBets = users.reduce((s, u) => s + u.total_points, 0)

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5">

        {/* ── Hero trophy banner ───────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 rounded-3xl p-5 mb-5 shadow-xl text-white">
          <div className="absolute -top-6 -end-6 text-8xl opacity-20 pointer-events-none select-none">
            🏆
          </div>
          <div className="absolute -bottom-8 -start-4 text-6xl opacity-10 pointer-events-none select-none">
            ⚽
          </div>

          <div className="relative">
            <h1 className="text-2xl font-extrabold leading-tight drop-shadow">
              🏆 טבלת המובילים
            </h1>
            <p className="text-amber-100 text-sm mt-0.5">
              מי ינחש הכי נכון את מונדיאל 2026?
            </p>

            {/* Stats row */}
            <div className="flex gap-2.5 mt-4">
              <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                <div className="text-xl font-extrabold tabular-nums">{users.length}</div>
                <div className="text-xs text-amber-100">משתתפים</div>
              </div>
              <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                <div className="text-xl font-extrabold tabular-nums">{totalBets}</div>
                <div className="text-xs text-amber-100">נקודות סה״כ</div>
              </div>
              {user && profile && (
                <div className="flex-1 bg-white/30 ring-2 ring-white/40 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">
                    {profile.total_points}
                  </div>
                  <div className="text-xs text-amber-100">הנקודות שלי</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── My rank card ─────────────────────────────── */}
        {user && profile && myRank > 0 && !loading && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎽'}
              </span>
              <div>
                <p className="text-emerald-800 font-bold text-sm">{profile.display_name}</p>
                <p className="text-emerald-600 text-xs">
                  מיקום #{myRank} מתוך {users.length}
                </p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                {profile.total_points}
              </p>
              <p className="text-xs text-emerald-500">נקודות</p>
            </div>
          </div>
        )}

        {/* ── Table ────────────────────────────────────── */}
        {loading ? (
          <Spinner />
        ) : (
          <LeaderboardTable users={users} currentUserId={user?.id} />
        )}
      </main>
    </>
  )
}
