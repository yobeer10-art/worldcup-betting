import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import LeaderboardTable from '../components/Leaderboard/LeaderboardTable'
import Spinner from '../components/UI/Spinner'

const KNOCKOUT_STAGES = ['round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

export default function LeaderboardPage() {
  const { user, profile } = useAuth()

  // ── Overall leaderboard ──────────────────────────────────────────
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  // ── Knockout leaderboard ─────────────────────────────────────────
  const [tab,      setTab]      = useState('overall')   // 'overall' | 'knockout'
  const [koUsers,  setKoUsers]  = useState(null)        // null = not yet fetched
  const [koLoading, setKoLoading] = useState(false)

  // Fetch overall on mount
  useEffect(() => {
    supabase
      .from('users')
      .select('id, display_name, total_points')
      .order('total_points', { ascending: false })
      .order('display_name', { ascending: true })
      .then(({ data }) => {
        setUsers(data ?? [])
        setLoading(false)
      })
  }, [])

  // Fetch knockout when that tab is first selected
  useEffect(() => {
    if (tab !== 'knockout' || koUsers !== null) return
    setKoLoading(true)
    supabase
      .rpc('knockout_leaderboard')
      .then(({ data, error }) => {
        if (error) {
          console.error('[knockout leaderboard] RPC error:', error)
          setKoUsers([])
        } else {
          // Map to the shape LeaderboardTable expects (total_points field)
          setKoUsers(
            (data ?? []).map(u => ({
              id:           u.user_id,
              display_name: u.display_name,
              total_points: Number(u.knockout_points ?? 0),
              bet_points:   Number(u.bet_points     ?? 0),
              bracket_points: Number(u.bracket_points ?? 0),
            }))
          )
        }
        setKoLoading(false)
      })
  }, [tab, koUsers])

  // ── Derived values ────────────────────────────────────────────────
  const isKo       = tab === 'knockout'
  const activeList = isKo ? (koUsers ?? []) : users
  const myRank     = activeList.findIndex(u => u.id === user?.id) + 1
  const myKo       = koUsers?.find(u => u.id === user?.id)

  const totalPts   = activeList.reduce((s, u) => s + u.total_points, 0)

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5 pb-24">

        {/* ── Tab toggle ──────────────────────────────── */}
        <div className="flex gap-2 mb-4 bg-slate-100 rounded-2xl p-1">
          <button
            onClick={() => setTab('overall')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              !isKo
                ? 'bg-white shadow text-amber-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            🏆 כללי
          </button>
          <button
            onClick={() => setTab('knockout')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              isKo
                ? 'bg-white shadow text-emerald-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            🎯 נוקאאוט
          </button>
        </div>

        {/* ── Hero banner ─────────────────────────────── */}
        {isKo ? (
          /* Knockout hero */
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 rounded-3xl p-5 mb-5 shadow-xl text-white">
            <div className="absolute -top-6 -end-6 text-8xl opacity-15 pointer-events-none select-none">🎯</div>
            <div className="absolute -bottom-8 -start-4 text-6xl opacity-10 pointer-events-none select-none">⚽</div>

            <div className="relative">
              <h1 className="text-2xl font-extrabold leading-tight drop-shadow">
                🎯 דירוג נוקאאוט
              </h1>
              <p className="text-emerald-100 text-sm mt-0.5">
                שלב 32 עד גמר · הימורים + ברקט · מתחילים מאפס
              </p>

              <div className="flex gap-2.5 mt-4">
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">
                    {koLoading ? '…' : (koUsers?.length ?? 0)}
                  </div>
                  <div className="text-xs text-emerald-100">משתתפים</div>
                </div>
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">
                    {koLoading ? '…' : totalPts}
                  </div>
                  <div className="text-xs text-emerald-100">נקודות נוקאאוט</div>
                </div>
                {user && myKo && (
                  <div className="flex-1 bg-white/30 ring-2 ring-white/40 rounded-xl px-3 py-2 text-center">
                    <div className="text-xl font-extrabold tabular-nums">
                      {myKo.total_points}
                    </div>
                    <div className="text-xs text-emerald-100">הנקודות שלי</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Overall hero (unchanged) */
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 rounded-3xl p-5 mb-5 shadow-xl text-white">
            <div className="absolute -top-6 -end-6 text-8xl opacity-20 pointer-events-none select-none">🏆</div>
            <div className="absolute -bottom-8 -start-4 text-6xl opacity-10 pointer-events-none select-none">⚽</div>

            <div className="relative">
              <h1 className="text-2xl font-extrabold leading-tight drop-shadow">
                🏆 טבלת המובילים
              </h1>
              <p className="text-amber-100 text-sm mt-0.5">
                מי ינחש הכי נכון את מונדיאל 2026?
              </p>

              <div className="flex gap-2.5 mt-4">
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">{users.length}</div>
                  <div className="text-xs text-amber-100">משתתפים</div>
                </div>
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">{totalPts}</div>
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
        )}

        {/* ── My rank card ─────────────────────────────── */}
        {user && profile && myRank > 0 && !loading && !koLoading && (
          <div className={`flex items-center justify-between rounded-2xl px-4 py-3 mb-5 shadow-sm ${
            isKo
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-emerald-50 border border-emerald-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎽'}
              </span>
              <div>
                <p className="text-emerald-800 font-bold text-sm">{profile.display_name}</p>
                <p className="text-emerald-600 text-xs">
                  מיקום #{myRank} מתוך {activeList.length}
                </p>
                {isKo && myKo && (
                  <p className="text-emerald-500 text-[10px] mt-0.5">
                    הימורים {myKo.bet_points} · ברקט {myKo.bracket_points}
                  </p>
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                {isKo ? myKo?.total_points ?? 0 : profile.total_points}
              </p>
              <p className="text-xs text-emerald-500">נקודות</p>
            </div>
          </div>
        )}

        {/* ── Table ────────────────────────────────────── */}
        {isKo ? (
          koLoading
            ? <Spinner />
            : koUsers?.length === 0
            ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">🎯</div>
                <p className="text-sm font-medium">עדיין אין נקודות נוקאאוט</p>
                <p className="text-xs mt-1 text-slate-300">הנקודות יופיעו עם תחילת שלב 32</p>
              </div>
            )
            : <LeaderboardTable users={koUsers} currentUserId={user?.id} />
        ) : (
          loading
            ? <Spinner />
            : <LeaderboardTable users={users} currentUserId={user?.id} />
        )}

      </main>
    </>
  )
}
