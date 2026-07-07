import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import FlagImg from '../UI/FlagImg'

// Props:
//   match        — raw DB row (id, match_number, match_date, status, result, home/away_score)
//   homeTeam     — resolved team name (may come from user's upstream pick)
//   awayTeam     — resolved team name
//   homePredicted — true when homeTeam comes from user's upstream prediction, not confirmed data
//   awayPredicted — true when awayTeam comes from user's upstream prediction
//   homeSource   — placeholder label when homeTeam is null ("מנצח M73")
//   awaySource   — placeholder label when awayTeam is null
//   prediction   — user's knockout_predictions row for this match (or null)
//   onPick(team) — called when user picks a winner; parent handles DB + cascade
export default function KnockoutMatchCard({
  match,
  homeTeam, awayTeam,
  homePredicted = false, awayPredicted = false,
  homeSource, awaySource,
  prediction,
  onPick,
  locked = false,
}) {
  const { user } = useAuth()
  const [justSaved, setJustSaved] = useState(false)

  // Per-match auto-lock: 5 min before this match's own kickoff
  const [now, setNow] = useState(Date.now)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!match.match_date) return
    const kickoff = new Date(match.match_date).getTime()
    const update  = () => setNow(Date.now)
    const remaining = kickoff - Date.now()
    if (remaining > 0) {
      timerRef.current = setInterval(update, remaining < 3_600_000 ? 10_000 : 60_000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [match.match_date])

  const kickoffMs     = match.match_date ? new Date(match.match_date).getTime() : null
  const minsToKickoff = kickoffMs ? Math.floor((kickoffMs - now) / 60_000) : null
  const autoLocked    = kickoffMs !== null && minsToKickoff !== null && minsToKickoff <= 5

  const isFinished = match.status === 'finished'
  const winner = isFinished
    ? (match.result === 'home' ? homeTeam : awayTeam)
    : null

  // Prediction summary values (works even for ghost-team picks)
  const userPick      = prediction?.predicted_winner ?? null
  const pickIsCorrect = isFinished && userPick !== null && userPick === winner
  const pickIsWrong   = isFinished && userPick !== null && userPick !== winner
  const pickInMatch   = userPick !== null && (userPick === homeTeam || userPick === awayTeam)

  // Can pick if both teams are known (real or predicted), not finished, not locked
  const canPredict = !!(user && homeTeam && awayTeam && !isFinished && !autoLocked && !locked)

  function pick(team) {
    if (!canPredict) return
    onPick?.(team)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  function TeamButton({ team, source, isPresumed }) {
    // isPresumed: team shown here comes from user's upstream pick, not confirmed
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
        disabled={!canPredict}
        className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl
          transition-all duration-200 active:scale-95
          border-2
          ${correct    ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-200/60'
          : wrong      ? 'border-rose-300 bg-rose-50 opacity-70'
          : isLoser    ? 'border-transparent bg-slate-50 opacity-50'
          : isWinner   ? 'border-amber-400 bg-amber-50 shadow-md'
          : picked && isPresumed
                       ? 'border-blue-300 border-dashed bg-blue-50 shadow-sm'
          : picked     ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-200/50'
          : canPredict && isPresumed
                       ? 'border-slate-200 border-dashed bg-white/80 hover:border-blue-300 hover:bg-blue-50'
          : canPredict ? 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
          : isPresumed ? 'border-slate-100 border-dashed bg-white/80'
          :              'border-slate-100 bg-white'
          }`}
      >
        <FlagImg team={team} size="md" />
        <span className={`text-xs font-bold text-center leading-tight line-clamp-2 ${
          isPresumed && !picked && !isFinished ? 'text-slate-400' : 'text-slate-700'
        }`}>
          {team}
        </span>
        {isPresumed && !isFinished && !picked && (
          <span className="text-[9px] text-slate-400 italic">ניחוש שלב קודם</span>
        )}
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
      {/* Top colour strip */}
      <div className={`h-1 w-full ${
        isFinished              ? 'bg-slate-300'
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
                  timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short',
                })}
                {' '}
                {new Date(match.match_date).toLocaleTimeString('he-IL', {
                  timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit',
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
            isFinished              ? 'bg-slate-100 text-slate-500'
            : match.status === 'live' ? 'bg-red-100 text-red-600'
            : locked                ? 'bg-rose-50 text-rose-500'
            : autoLocked            ? 'bg-amber-100 text-amber-600'
            : homeTeam && awayTeam  ? 'bg-blue-50 text-blue-600'
            : 'bg-slate-100 text-slate-400'
          }`}>
            {isFinished              ? 'הסתיים'
             : match.status === 'live' ? '🔴 חי'
             : locked                 ? '🔒 ננעל'
             : autoLocked             ? `🔒 ${minsToKickoff}ד׳`
             : homeTeam && awayTeam   ? 'פתוח'
             : 'טרם נקבע'}
          </span>
        </div>

        {/* Teams */}
        <div className="flex gap-2">
          <TeamButton team={homeTeam} source={homeSource} isPresumed={homePredicted} />
          <div className="flex items-center text-slate-300 font-black text-sm flex-shrink-0 mt-1">vs</div>
          <TeamButton team={awayTeam} source={awaySource} isPresumed={awayPredicted} />
        </div>

        {justSaved && (
          <p className="text-xs text-emerald-600 font-semibold mt-2 text-center animate-pulse">✅ נשמר!</p>
        )}
        {!user && homeTeam && awayTeam && !isFinished && !autoLocked && (
          <p className="text-[11px] text-slate-400 text-center mt-2">
            <a href="/auth" className="text-blue-500 underline">התחבר</a> כדי לנחש
          </p>
        )}
        {/* Prediction footer — shows for any match where user has a pick */}
        {userPick && (
          <div className={`mt-2 pt-2 border-t flex items-center gap-2 ${
            pickIsCorrect ? 'border-emerald-100'
            : pickIsWrong  ? 'border-rose-100'
            : 'border-slate-100'
          }`}>
            <span className="text-[10px] text-slate-400 shrink-0">הימרת:</span>

            {/* Ghost pick: predicted team not in this match */}
            {!pickInMatch && (
              <span className="text-[11px] font-bold text-slate-400 italic truncate flex-1">
                {userPick}
              </span>
            )}

            {/* Normal pick: predicted team IS in this match */}
            {pickInMatch && (
              <span className={`text-[11px] font-bold truncate flex-1 ${
                pickIsCorrect ? 'text-emerald-600'
                : pickIsWrong  ? 'text-rose-500'
                : 'text-blue-600'
              }`}>
                {userPick}
              </span>
            )}

            {/* Result indicator */}
            {isFinished && pickIsCorrect && (
              <span className="text-[11px] font-black text-emerald-600 shrink-0">
                ✓ +{prediction.points_earned}נק׳
              </span>
            )}
            {isFinished && pickIsWrong && (
              <span className="text-[11px] font-bold text-slate-400 shrink-0">✗</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
