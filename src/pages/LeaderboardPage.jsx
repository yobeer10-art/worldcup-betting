import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import LeaderboardTable from '../components/Leaderboard/LeaderboardTable'
import Spinner from '../components/UI/Spinner'

export default function LeaderboardPage() {
  const { user, profile } = useAuth()

  const [tab, setTab] = useState('group') // 'group' | 'knockout'

  // ── Group-stage leaderboard ───────────────────────────────────────
  const [groupUsers,   setGroupUsers]   = useState(null)
  const [groupLoading, setGroupLoading] = useState(false)

  // ── Knockout leaderboard ─────────────────────────────────────────
  const [koUsers,   setKoUsers]   = useState(null)
  const [koLoading, setKoLoading] = useState(false)

  // Fetch group-stage on mount
  useEffect(() => {
    if (groupUsers !== null) return
    setGroupLoading(true)
    supabase
      .rpc('group_stage_leaderboard')
      .then(({ data, error }) => {
        if (error) console.error('[group leaderboard]', error)
        setGroupUsers(
          (data ?? []).map(u => ({
            id:                u.user_id,
            display_name:      u.display_name,
            total_points:      Number(u.group_points      ?? 0),
            bet_points:        Number(u.bet_points        ?? 0),
            group_pred_points: Number(u.group_pred_points ?? 0),
          }))
        )
        setGroupLoading(false)
      })
  }, [groupUsers])

  // Fetch knockout when tab first selected
  useEffect(() => {
    if (tab !== 'knockout' || koUsers !== null) return
    setKoLoading(true)
    supabase
      .rpc('knockout_leaderboard')
      .then(({ data, error }) => {
        if (error) console.error('[knockout leaderboard]', error)
        setKoUsers(
          (data ?? []).map(u => ({
            id:             u.user_id,
            display_name:   u.display_name,
            total_points:   Number(u.knockout_points ?? 0),
            bet_points:     Number(u.bet_points      ?? 0),
            bracket_points: Number(u.bracket_points  ?? 0),
          }))
        )
        setKoLoading(false)
      })
  }, [tab, koUsers])

  const isKo       = tab === 'knockout'
  const activeList = isKo ? (koUsers ?? []) : (groupUsers ?? [])
  const myRank     = activeList.findIndex(u => u.id === user?.id) + 1
  const myGroup    = groupUsers?.find(u => u.id === user?.id)
  const myKo       = koUsers?.find(u => u.id === user?.id)
  const myEntry    = isKo ? myKo : myGroup
  const totalPts   = activeList.reduce((s, u) => s + u.total_points, 0)
  const loading    = isKo ? koLoading : groupLoading

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5 pb-24">

        {/* ── Tab toggle ──────────────────────────────── */}
        <div className="flex gap-2 mb-4 bg-slate-100 rounded-2xl p-1">
          <button
            onClick={() => setTab('group')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              !isKo
                ? 'bg-white shadow text-amber-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            🏆 שלב הבתים
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
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 rounded-3xl p-5 mb-5 shadow-xl text-white">
            <div className="absolute -top-6 -end-6 text-8xl opacity-15 pointer-events-none select-none">🎯</div>
            <div className="absolute -bottom-8 -start-4 text-6xl opacity-10 pointer-events-none select-none">⚽</div>
            <div className="relative">
              <h1 className="text-2xl font-extrabold leading-tight drop-shadow">🎯 דירוג נוקאאוט</h1>
              <p className="text-emerald-100 text-sm mt-0.5">שלב 32 עד גמר · הימורים + ברקט · מתחילים מאפס</p>
              <div className="flex gap-2.5 mt-4">
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">{koLoading ? '…' : (koUsers?.length ?? 0)}</div>
                  <div className="text-xs text-emerald-100">משתתפים</div>
                </div>
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">{koLoading ? '…' : totalPts}</div>
                  <div className="text-xs text-emerald-100">נקודות נוקאאוט</div>
                </div>
                {user && myKo && (
                  <div className="flex-1 bg-white/30 ring-2 ring-white/40 rounded-xl px-3 py-2 text-center">
                    <div className="text-xl font-extrabold tabular-nums">{myKo.total_points}</div>
                    <div className="text-xs text-emerald-100">הנקודות שלי</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 rounded-3xl p-5 mb-5 shadow-xl text-white">
            <div className="absolute -top-6 -end-6 text-8xl opacity-20 pointer-events-none select-none">🏆</div>
            <div className="absolute -bottom-8 -start-4 text-6xl opacity-10 pointer-events-none select-none">⚽</div>
            <div className="relative">
              <h1 className="text-2xl font-extrabold leading-tight drop-shadow">🏆 דירוג שלב הבתים</h1>
              <p className="text-amber-100 text-sm mt-0.5">הימורי שלב הבתים · ניחושי קבוצות · קפוא</p>
              <div className="flex gap-2.5 mt-4">
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">{groupLoading ? '…' : (groupUsers?.length ?? 0)}</div>
                  <div className="text-xs text-amber-100">משתתפים</div>
                </div>
                <div className="flex-1 bg-white/20 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-extrabold tabular-nums">{groupLoading ? '…' : totalPts}</div>
                  <div className="text-xs text-amber-100">נקודות בתים</div>
                </div>
                {user && myGroup && (
                  <div className="flex-1 bg-white/30 ring-2 ring-white/40 rounded-xl px-3 py-2 text-center">
                    <div className="text-xl font-extrabold tabular-nums">{myGroup.total_points}</div>
                    <div className="text-xs text-amber-100">הנקודות שלי</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── My rank card ─────────────────────────────── */}
        {user && myEntry && myRank > 0 && !loading && (
          <div className="flex items-center justify-between rounded-2xl px-4 py-3 mb-5 shadow-sm bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎽'}
              </span>
              <div>
                <p className="text-emerald-800 font-bold text-sm">{profile?.display_name}</p>
                <p className="text-emerald-600 text-xs">מיקום #{myRank} מתוך {activeList.length}</p>
                {isKo && myKo && (
                  <p className="text-emerald-500 text-[10px] mt-0.5">הימורים {myKo.bet_points} · ברקט {myKo.bracket_points}</p>
                )}
                {!isKo && myGroup && (
                  <p className="text-emerald-500 text-[10px] mt-0.5">הימורים {myGroup.bet_points} · ניחושי בתים {myGroup.group_pred_points}</p>
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{myEntry.total_points}</p>
              <p className="text-xs text-emerald-500">נקודות</p>
            </div>
          </div>
        )}

        {/* ── Table ────────────────────────────────────── */}
        {loading
          ? <Spinner />
          : activeList.length === 0
          ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">{isKo ? '🎯' : '🏆'}</div>
              <p className="text-sm font-medium">{isKo ? 'עדיין אין נקודות נוקאאוט' : 'עדיין אין נקודות'}</p>
            </div>
          )
          : <LeaderboardTable users={activeList} currentUserId={user?.id} />
        }

      </main>
    </>
  )
}
