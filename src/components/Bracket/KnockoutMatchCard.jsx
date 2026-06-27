import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import FlagImg from '../UI/FlagImg'

// locked = true when the global bracket betting window is closed
export default function KnockoutMatchCard({ match, prediction, onSaved, locked = false }) {
  const { user } = useAuth()
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState(null)
  const [justSaved, setJustSaved] = useState(false)

  // Auto-lock 5 min before kickoff (if match_date is known)
  const [now, setNow] = useState(Date.now)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!match.match_date) return
    const kickoff = new Date(match.match_date).getTime()
    const update = () => setNow(Date.now())
    const remaining = kickoff - Date.now()
    if (remaining > 0) {
      const interval = remaining < 3_600_000 ? 10_000 : 60_000
      timerRef.current = setInterval(update, interval)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [match.match_date])

  const kickoffMs     = match.match_date ? new Date(match.match_date).getTime() : null
  const minsToKickoff = kickoffMs ? Math.floor((kickoffMs - now) / 60_000) : null
  const autoLocked    = kickoffMs !== null && minsToKickoff !== null && minsToKickoff <= 5

  const teamsKnown = match.home_team && match.away_team
  const isFinished = match.status === 'finished'
  const canPredict = user && teamsKnown && !isFinished && !locked && !autoLocked

  const winner = isFinished
    ? (match.result === 'home' ? match.home_team : match.away_team)
    : null

  async function pick(team) {
    if (!canPredict || saving) return
    setSaving(true); setErr(null)
    const { error } = await supabase.from('knockout_predictions').upsert(
      { user_id: user.id, bracket_match_id: match.id, predicted_winner: team },
      { onConflict: 'user_id,bracket_match_id' },
    )
    setSaving(false)
    if (error) { setErr(error.message); return }
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
    onSaved?.()
  }

  function TeamButton({ team, source }) {
    if (!team) return (
      <div className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl
                      bg-slate-50 border border-dashed border-slate-200">
        <span className="text-2xl opacity-20">?</span>
        <span className="text-[10px] text-slate-300 font-medium text-center leading-tight">
          {source ?? 'טרם נקבע'}
        </span>
      </div>
    )

    const picked   = prediction?.predicted_winner === team
    const isWinner = isFinished && winner === team
    const isLoser  = isFinished && winner && winner !== team
    const correct  = isFinished && picked && isWinner
    const wrong    = isFinished && picked && !isWinner

    return (
      <button
        onClick={() => pick(team)}
        disabled={!canPredict || saving}
        className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2
          transition-all duration-200 active:scale-95
          ${correct  ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-200/60'
            : wrong  ? 'border-rose-300 bg-rose-50 opacity-70'
            : isLoser  ? 'border-transparent bg-slate-50 opacity-50'
            : isWinner ? 'border-amber-400 bg-amber-50 shadow-md'
            : picked   ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-200/50'
            : canPredict ? 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
            : 'border-slate-100 bg-white'
          }
          ${saving ? 'cursor-wait' : ''}
        `}
      >
        <FlagImg team={team} size="md" />
        <span className="text-xs font-bold text-slate-700 text-center leading-tight line-clamp-2">
          {team}
        </span>
        {correct  && <span className="text-[10px] font-bold text-emerald-600">✅ ניחשת!</span>}
        {wrong    && <span className="text-[10px] font-bold text-rose-500">❌</span>}
        {isWinner && !picked && <span className="text-[10px] font-bold text-amber-600">🏆 ניצח</span>}
        {!isFinished && picked && !justSaved && (
          <span className="text-[10px] text-blue-500 font-semibold">✓ הניחוש שלך</span>
        )}
      </button>
    )
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      isFinished ? 'border-slate-200' : 'border-slate-200 hover:border-blue-200'
    }`}>
      {/* Top strip */}
      <div className={`h-1 w-full ${
        isFinished     ? 'bg-slate-300'
        : match.status === 'live' ? 'bg-gradient-to-r from-red-400 to-rose-500'
        : 'bg-gradient-to-r from-blue-400 to-indigo-500'
      }`} />

      <div className="p-3">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-3 gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {match.match_number && (
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                M{match.match_number}
              </span>
            )}
            {match.match_date && (
              <span className="text-[11px] text-slate-400 truncate">
                {new Date(match.match_date).toLocaleDateString('he-IL', {
                  timeZone: 'Asia/Jerusalem',
                  day: 'numeric', month: 'short',
                })}
                {' '}
                {new Date(match.match_date).toLocaleTimeString('he-IL', {
                  timeZone: 'Asia/Jerusalem',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>

          {isFinished && match.home_score != null && (
            <span className="text-sm font-extrabold text-slate-700 tabular-nums shrink-0">
              {match.home_score} — {match.away_score}
            </span>
          )}

          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
            isFinished          ? 'bg-slate-100 text-slate-500'
            : match.status === 'live'  ? 'bg-red-100 text-red-600'
            : locked || autoLocked ? 'bg-amber-100 text-amber-600'
            : teamsKnown        ? 'bg-blue-50 text-blue-600'
            : 'bg-slate-100 text-slate-400'
          }`}>
            {isFinished           ? 'הסתיים'
             : match.status === 'live' ? '🔴 חי'
             : locked             ? '🔒 נעול'
             : autoLocked         ? `🔒 ${minsToKickoff}ד׳`
             : teamsKnown         ? 'קרוב'
             : 'טרם נקבע'}
          </span>
        </div>

        {/* Teams */}
        <div className="flex gap-2">
          <TeamButton team={match.home_team} source={match.home_source} />
          <div className="flex items-center text-slate-300 font-black text-sm flex-shrink-0 mt-1">
            vs
          </div>
          <TeamButton team={match.away_team} source={match.away_source} />
        </div>

        {err && <p className="text-xs text-red-500 mt-2 text-center">{err}</p>}
        {justSaved && (
          <p className="text-xs text-emerald-600 font-semibold mt-2 text-center animate-pulse">
            ✅ נשמר!
          </p>
        )}
        {!user && teamsKnown && !isFinished && !locked && !autoLocked && (
          <p className="text-[11px] text-slate-400 text-center mt-2">
            <a href="/auth" className="text-blue-500 underline">התחבר</a> כדי לנחש
          </p>
        )}

        {/* Points earned */}
        {isFinished && prediction?.is_graded && (
          <div className={`mt-2 text-center text-xs font-bold ${
            prediction.points_earned > 0 ? 'text-emerald-600' : 'text-rose-500'
          }`}>
            {prediction.points_earned > 0 ? `+${prediction.points_earned} נקודות` : '0 נקודות'}
          </div>
        )}
      </div>
    </div>
  )
}
