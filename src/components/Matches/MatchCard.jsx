import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const LABELS = {
  home: 'ניצחון הבית',
  draw: 'תיקו',
  away: 'ניצחון האורח',
}

const STATUS_CONFIG = {
  upcoming: { label: 'קרוב', cls: 'bg-blue-100 text-blue-700' },
  live: { label: '🔴 בשידור חי', cls: 'bg-red-100 text-red-700 animate-pulse' },
  finished: { label: 'הסתיים', cls: 'bg-gray-100 text-gray-500' },
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

export default function MatchCard({ match, userBet, onBetPlaced }) {
  const { user } = useAuth()
  const [activePrediction, setActivePrediction] = useState(userBet?.prediction ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isBettingOpen =
    match.status === 'upcoming' && new Date(match.match_date) > new Date()
  const isFinished = match.status === 'finished'
  const statusCfg = STATUS_CONFIG[match.status] ?? STATUS_CONFIG.upcoming

  async function placeBet(prediction) {
    if (!user || !isBettingOpen || saving) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('bets').upsert(
      { user_id: user.id, match_id: match.id, prediction },
      { onConflict: 'user_id,match_id' },
    )
    if (err) {
      setError('שגיאה בשמירת הניחוש. נסה שוב.')
    } else {
      setActivePrediction(prediction)
      onBetPlaced?.()
    }
    setSaving(false)
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
        isFinished ? 'border-gray-200' : 'border-green-100'
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-xs text-gray-400">{formatDate(match.match_date)}</span>
        <div className="flex items-center gap-2">
          {match.group_name && (
            <span className="text-xs text-gray-400">קבוצה {match.group_name}</span>
          )}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Teams row */}
      <div className="px-4 py-5 flex items-center justify-between gap-2">
        {/* Home */}
        <div className="flex-1 text-center">
          <div className="text-3xl mb-1">🏠</div>
          <div className="font-bold text-gray-800 text-base leading-tight">{match.home_team}</div>
          <div className="text-xs text-gray-400 mt-0.5">בית</div>
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center px-3">
          {isFinished && match.home_score != null ? (
            <span className="text-2xl font-extrabold text-gray-800 tabular-nums">
              {match.home_score}–{match.away_score}
            </span>
          ) : (
            <span className="text-base font-bold text-gray-300">VS</span>
          )}
          {isFinished && match.result && (
            <span className="text-xs text-gray-400 mt-1">{LABELS[match.result]}</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 text-center">
          <div className="text-3xl mb-1">✈️</div>
          <div className="font-bold text-gray-800 text-base leading-tight">{match.away_team}</div>
          <div className="text-xs text-gray-400 mt-0.5">אורח</div>
        </div>
      </div>

      {/* Betting area */}
      <div className="px-4 pb-4">
        {!user ? (
          <p className="text-center text-sm text-gray-400 py-1">
            <Link to="/auth" className="text-green-600 hover:underline font-medium">
              התחבר
            </Link>{' '}
            כדי לנחש
          </p>
        ) : isBettingOpen ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(['home', 'draw', 'away']).map((pred) => (
                <button
                  key={pred}
                  onClick={() => placeBet(pred)}
                  disabled={saving}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    activePrediction === pred
                      ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
                  } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {LABELS[pred]}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            {activePrediction && (
              <p className="text-center text-xs text-gray-400 mt-2">
                הניחוש שלך:{' '}
                <span className="font-semibold text-green-600">{LABELS[activePrediction]}</span>
              </p>
            )}
          </>
        ) : activePrediction ? (
          <div
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm ${
              isFinished
                ? userBet?.is_correct
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-600'
                : 'bg-gray-50 text-gray-500'
            }`}
          >
            {isFinished && (userBet?.is_correct ? '✅' : '❌')}
            <span>
              הניחוש שלך: <strong>{LABELS[activePrediction]}</strong>
            </span>
            {isFinished && userBet?.is_correct && (
              <span className="font-bold text-green-600">+1 נקודה!</span>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-1">
            {match.status === 'live' ? '🔴 המשחק כבר התחיל' : 'ההימור נסגר'}
          </p>
        )}
      </div>
    </div>
  )
}
