import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getFlag } from '../../lib/flags'

/* ── Bet-button colour config ───────────────────────── */
const BET_CFG = {
  home: {
    label: 'ניצחון הבית',
    icon: '🏠',
    idle: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 hover:shadow-sm',
    active: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-transparent shadow-lg shadow-sky-200/60',
  },
  draw: {
    label: 'תיקו',
    icon: '🤝',
    idle: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm',
    active: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-transparent shadow-lg shadow-amber-200/60',
  },
  away: {
    label: 'ניצחון האורח',
    icon: '✈️',
    idle: 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300 hover:shadow-sm',
    active: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white border-transparent shadow-lg shadow-violet-200/60',
  },
}

/* ── Top-strip colour per status ─────────────────────── */
const STRIP = {
  upcoming: 'bg-gradient-to-r from-emerald-400 to-green-500',
  live:     'bg-gradient-to-r from-red-500 to-rose-500',
  finished: 'bg-gray-300',
}

/* ── Status badge ────────────────────────────────────── */
function StatusBadge({ status }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full">
        <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block" />
        בשידור חי
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-1 rounded-full">
        הסתיים
      </span>
    )
  }
  return (
    <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
      קרוב
    </span>
  )
}

/* ── Team block ──────────────────────────────────────── */
function TeamBlock({ name, label }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0 px-1">
      <span className="text-[44px] leading-none drop-shadow-sm select-none">
        {getFlag(name)}
      </span>
      <span className="font-bold text-slate-800 text-sm text-center leading-snug line-clamp-2">
        {name}
      </span>
      <span className="text-[11px] text-slate-400 font-medium">{label}</span>
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ── Main component ──────────────────────────────────── */
export default function MatchCard({ match, userBet, onBetPlaced }) {
  const { user } = useAuth()
  const [activePred, setActivePred] = useState(userBet?.prediction ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [justSaved, setJustSaved] = useState(false)

  const isBettingOpen =
    match.status === 'upcoming' && new Date(match.match_date) > new Date()
  const isFinished = match.status === 'finished'

  async function placeBet(pred) {
    if (!user || !isBettingOpen || saving) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('bets').upsert(
      { user_id: user.id, match_id: match.id, prediction: pred },
      { onConflict: 'user_id,match_id' },
    )
    if (err) {
      setError('שגיאה בשמירת הניחוש. נסה שוב.')
    } else {
      setActivePred(pred)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1800)
      onBetPlaced?.()
    }
    setSaving(false)
  }

  return (
    <div className="match-card bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
      {/* Coloured top strip */}
      <div className={`h-[3px] ${STRIP[match.status] ?? STRIP.upcoming}`} />

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70">
        <span className="text-xs text-slate-400 font-medium">{formatDate(match.match_date)}</span>
        <div className="flex items-center gap-2">
          {match.group_name && (
            <span className="text-xs text-slate-400">קבוצה {match.group_name}</span>
          )}
          <StatusBadge status={match.status} />
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between px-4 py-5 gap-2">
        <TeamBlock name={match.home_team} label="בית" />

        {/* Centre: VS or score */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          {isFinished && match.home_score != null ? (
            <>
              <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-inner">
                <span className="text-xl font-black tabular-nums tracking-tight">
                  {match.home_score}–{match.away_score}
                </span>
              </div>
              {match.result && (
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {BET_CFG[match.result]?.label}
                </span>
              )}
            </>
          ) : (
            <div className="border-2 border-slate-200 px-4 py-1.5 rounded-xl bg-white">
              <span className="text-sm font-black text-slate-300 tracking-[0.2em]">VS</span>
            </div>
          )}
        </div>

        <TeamBlock name={match.away_team} label="אורח" />
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100" />

      {/* Bet section */}
      <div className="px-4 py-3.5">
        {!user ? (
          <p className="text-center text-sm text-slate-400 py-0.5">
            <Link to="/auth" className="text-emerald-600 hover:underline font-semibold">
              התחבר
            </Link>{' '}
            כדי לנחש
          </p>
        ) : isBettingOpen ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(['home', 'draw', 'away']).map((pred) => {
                const cfg = BET_CFG[pred]
                const isActive = activePred === pred
                return (
                  <button
                    key={pred}
                    onClick={() => placeBet(pred)}
                    disabled={saving}
                    className={`relative flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95 ${
                      isActive ? cfg.active : cfg.idle
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-base leading-none">{cfg.icon}</span>
                    <span className="leading-tight text-center">{cfg.label}</span>
                    {isActive && (
                      <span className="absolute -top-1.5 -start-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {error && (
              <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
            )}

            {justSaved && (
              <p className="text-center text-xs text-emerald-600 font-semibold mt-2 animate-pulse">
                ✓ הניחוש נשמר!
              </p>
            )}

            {activePred && !justSaved && (
              <p className="text-center text-xs text-slate-400 mt-2">
                הניחוש שלך:{' '}
                <span className="font-semibold text-slate-600">
                  {BET_CFG[activePred].icon} {BET_CFG[activePred].label}
                </span>
              </p>
            )}
          </>
        ) : activePred ? (
          /* Locked bet — show result */
          <div
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium ${
              isFinished
                ? userBet?.is_correct
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}
          >
            {isFinished && (
              <span className="text-base">{userBet?.is_correct ? '✅' : '❌'}</span>
            )}
            <span>
              הניחוש שלך:{' '}
              <strong>
                {BET_CFG[activePred]?.icon} {BET_CFG[activePred]?.label}
              </strong>
            </span>
            {isFinished && userBet?.is_correct && (
              <span className="font-extrabold text-emerald-600 mr-1">+1 נקודה!</span>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-slate-400 py-0.5">
            {match.status === 'live' ? '🔴 המשחק כבר התחיל' : '🔒 ההימור נסגר'}
          </p>
        )}
      </div>
    </div>
  )
}
