import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import FlagImg from '../UI/FlagImg'

/* ── Config ──────────────────────────────────────────────── */
const BET_CFG = {
  home: {
    label: 'ניצחון בית',
    icon:  '🏠',
    idle:   'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:border-sky-300',
    active: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-transparent shadow-lg shadow-sky-300/40',
    resultBg: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  draw: {
    label: 'תיקו',
    icon:  '🤝',
    idle:   'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300',
    active: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-transparent shadow-lg shadow-amber-300/40',
    resultBg: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  away: {
    label: 'ניצחון אורח',
    icon:  '✈️',
    idle:   'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300',
    active: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white border-transparent shadow-lg shadow-violet-300/40',
    resultBg: 'bg-violet-50 border-violet-200 text-violet-800',
  },
}

const STRIP_CLS = {
  upcoming: 'bg-gradient-to-r from-emerald-400 to-teal-400',
  live:     'bg-gradient-to-r from-red-400 to-rose-500',
  finished: 'bg-gradient-to-r from-slate-300 to-slate-400',
}

/* ── Helpers ─────────────────────────────────────────────── */
function fmtDate(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Returns an error string if the score combination is logically invalid,
 * OR null if everything is fine (including partially filled — no error shown
 * while the user is still typing the second field).
 *
 * Call with onlySaveBlock=true to get the "save-blocking" flag without
 * producing a user-visible message.
 */
function validateScore(pred, hs, as_, homeTeam, awayTeam) {
  // Both empty → optional scores not entered, totally fine
  if (hs === '' && as_ === '') return null

  // One empty, one filled → user is mid-typing; don't show an error yet
  if (hs === '' || as_ === '') return null

  const h = parseInt(hs, 10), a = parseInt(as_, 10)
  if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return 'מספרים חיוביים בלבד (0-99)'
  if (!pred) return null
  if (pred === 'home' && h <= a) return `לניצחון ${homeTeam}: סכור הבית חייב להיות גבוה יותר`
  if (pred === 'away' && a <= h) return `לניצחון ${awayTeam}: סכור האורח חייב להיות גבוה יותר`
  if (pred === 'draw' && h !== a) return 'לתיקו — שני הסכורים חייבים להיות שווים'
  return null
}

/**
 * Whether saving should be blocked (score fields are in a half-filled or
 * inconsistent state).  Separate from the visual error so the button goes
 * grey while typing without showing a red message.
 */
function isSaveBlocked(pred, hs, as_, homeTeam, awayTeam) {
  if (hs === '' && as_ === '') return false          // no scores → save with winner only
  if (hs === '' || as_ === '') return true           // one missing → block silently
  return validateScore(pred, hs, as_, homeTeam, awayTeam) !== null
}

/* ── Sub-components ──────────────────────────────────────── */
function StatusBadge({ status }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm shadow-red-300/60">
      <span className="live-dot w-2 h-2 rounded-full bg-white inline-block" />
      בשידור חי
    </span>
  )
  if (status === 'finished') return (
    <span className="bg-slate-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
      הסתיים
    </span>
  )
  return (
    <span className="bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
      קרוב
    </span>
  )
}

function TeamBlock({ name, label }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2 min-w-0 px-2">
      <FlagImg team={name} size="lg" className="drop-shadow-md" />
      <span className="font-extrabold text-slate-900 text-sm text-center leading-snug line-clamp-2">{name}</span>
      <span className="text-[11px] text-slate-400 font-medium tracking-wide">{label}</span>
    </div>
  )
}

/* ── Floating +pts badge ─────────────────────────────────── */
function FloatingBadge({ pts, onDone }) {
  return (
    <div
      className="float-badge absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
      onAnimationEnd={onDone}
    >
      <div className="bg-gradient-to-br from-amber-400 to-yellow-300 text-amber-900 font-extrabold text-lg px-4 py-2 rounded-2xl shadow-xl">
        +{pts} נק׳! 🎉
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export default function MatchCard({ match, userBet, onBetPlaced }) {
  const { user } = useAuth()

  // Prediction state (synced from userBet on mount)
  const [pred,       setPred]      = useState(userBet?.prediction ?? null)
  const [homeScore,  setHomeScore] = useState(
    userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : ''
  )
  const [awayScore,  setAwayScore] = useState(
    userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : ''
  )
  const [saving,     setSaving]    = useState(false)
  const [error,      setError]     = useState(null)
  const [justSaved,  setJustSaved] = useState(false)
  const [showFloat,  setShowFloat] = useState(false)
  const [celebClass, setCelebClass] = useState('')
  const didCelebrate = useRef(false)
  const cardRef      = useRef(null)

  const isBettingOpen = match.status === 'upcoming' && !match.is_locked &&
                        new Date(match.match_date) > new Date()
  const isFinished    = match.status === 'finished'

  // Sync prop → state when parent refetches
  useEffect(() => {
    if (!isBettingOpen) {
      setPred(userBet?.prediction ?? null)
      setHomeScore(userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : '')
      setAwayScore(userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : '')
    }
  }, [userBet, isBettingOpen])

  // Celebration on win
  useEffect(() => {
    if (isFinished && userBet?.is_correct && !didCelebrate.current) {
      didCelebrate.current = true
      const cls = (userBet.points_earned ?? 0) >= 3 ? 'score-celebrate' : 'win-celebrate'
      setCelebClass(cls)
      setShowFloat(true)
      setTimeout(() => setCelebClass(''), 2500)
    }
  }, [isFinished, userBet?.is_correct, userBet?.points_earned])

  // Visible score error (only when BOTH fields are filled)
  const scoreErr = validateScore(pred, homeScore, awayScore, match.home_team, match.away_team)
  // Whether the Save button should be disabled (includes half-filled state)
  const saveBlocked = isSaveBlocked(pred, homeScore, awayScore, match.home_team, match.away_team)

  async function saveBet() {
    if (!pred) { setError('בחר תחילה מי ינצח'); return }
    if (saveBlocked) {
      setError(scoreErr ?? 'הזן ניחוש סכור לשתי הקבוצות')
      return
    }
    setSaving(true); setError(null)

    const { error: err } = await supabase.from('bets').upsert(
      {
        user_id:              user.id,
        match_id:             match.id,
        prediction:           pred,
        predicted_home_score: homeScore !== '' ? parseInt(homeScore, 10) : null,
        predicted_away_score: awayScore !== '' ? parseInt(awayScore, 10) : null,
      },
      { onConflict: 'user_id,match_id' },
    )
    setSaving(false)
    if (err) { setError('שגיאה בשמירת הניחוש. נסה שוב.'); return }

    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
    onBetPlaced?.()
  }

  // Score inputs auto-infer prediction when both are filled
  function handleScoreChange(side, value) {
    const hs  = side === 'home' ? value : homeScore
    const as_ = side === 'away' ? value : awayScore
    if (side === 'home') setHomeScore(value)
    else                 setAwayScore(value)
    setError(null)

    const h = parseInt(hs, 10), a = parseInt(as_, 10)
    if (!isNaN(h) && !isNaN(a)) {
      if (h > a)      setPred('home')
      else if (a > h) setPred('away')
      else            setPred('draw')
    }
  }

  /* ---------- render sections ---------- */

  function renderBettingSection() {
    if (!user) return (
      <div className="px-4 py-3 text-center text-sm text-slate-400">
        <Link to="/auth" className="text-emerald-600 hover:underline font-semibold">התחבר</Link>
        {' '}כדי לנחש
      </div>
    )

    if (isBettingOpen) return (
      <div className="px-4 pb-4 space-y-3">

        {/* Step 1 */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
            שלב 1 — מי ינצח? *
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['home', 'draw', 'away']).map(key => {
              const cfg = BET_CFG[key]
              const isActive = pred === key
              return (
                <button
                  key={key}
                  onClick={() => { setPred(key); setError(null) }}
                  className={`relative flex flex-col items-center gap-1 py-3 px-1.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-95 border ${
                    isActive ? cfg.active : cfg.idle
                  }`}
                >
                  {isActive && (
                    <span className="absolute -top-1.5 -start-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm z-10">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    </span>
                  )}
                  <span className="text-xl leading-none">{cfg.icon}</span>
                  <span className="text-center leading-tight">{cfg.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2 — appears after winner is picked */}
        {pred && (
          <div className="animate-slide-down">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                שלב 2 — תוצאה מדויקת (אופציונלי)
              </p>
              <span className="text-[11px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                +2 נק׳ בונוס!
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-3 border border-slate-200">
              <div className="flex-1 text-center">
                <div className="text-[11px] text-slate-500 mb-1 truncate">{match.home_team}</div>
                <input
                  type="number" min="0" max="20"
                  value={homeScore}
                  onChange={e => handleScoreChange('home', e.target.value)}
                  placeholder="0"
                  className="score-input w-full text-center text-2xl font-extrabold bg-white border-2 border-slate-200 focus:border-emerald-400 rounded-xl p-2 outline-none transition-colors tabular-nums"
                />
              </div>
              <div className="text-slate-300 font-black text-xl flex-shrink-0 mt-4">—</div>
              <div className="flex-1 text-center">
                <div className="text-[11px] text-slate-500 mb-1 truncate">{match.away_team}</div>
                <input
                  type="number" min="0" max="20"
                  value={awayScore}
                  onChange={e => handleScoreChange('away', e.target.value)}
                  placeholder="0"
                  className="score-input w-full text-center text-2xl font-extrabold bg-white border-2 border-slate-200 focus:border-emerald-400 rounded-xl p-2 outline-none transition-colors tabular-nums"
                />
              </div>
            </div>
            {/* Only show score error when BOTH fields are filled */}
            {scoreErr && (
              <p className="text-red-500 text-xs mt-1.5 text-center">{scoreErr}</p>
            )}
          </div>
        )}

        {/* General error */}
        {error && <p className="text-red-500 text-xs text-center">{error}</p>}

        {/* Save button */}
        {pred && (
          <button
            onClick={saveBet}
            disabled={saving || saveBlocked}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-emerald-300/40 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> שומר...</>
            ) : justSaved ? (
              '✅ נשמר!'
            ) : (
              '🎯 שמור ניחוש'
            )}
          </button>
        )}

        {/* Current bet summary */}
        {!justSaved && userBet?.prediction && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <span>ניחוש קודם:</span>
            <span className="font-semibold text-slate-600">
              {BET_CFG[userBet.prediction]?.icon} {BET_CFG[userBet.prediction]?.label}
              {userBet.predicted_home_score != null &&
                ` · ${userBet.predicted_home_score}–${userBet.predicted_away_score}`}
            </span>
          </div>
        )}
      </div>
    )

    // Betting closed — show saved bet or reason
    if (pred) {
      const wonPts  = userBet?.points_earned ?? 0
      const correct = userBet?.is_correct
      const cfg     = BET_CFG[pred]

      return (
        <div className="px-4 pb-4">
          <div className={`rounded-2xl px-4 py-3 border flex flex-col gap-1.5 ${
            !isFinished ? 'bg-slate-50 border-slate-200'
            : correct
              ? wonPts >= 3
                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300'
                : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300'
              : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {isFinished && <span>{correct ? (wonPts >= 3 ? '🌟' : '✅') : '❌'}</span>}
                <span>{cfg.icon} {cfg.label}</span>
                {homeScore !== '' && (
                  <span className="text-slate-500 font-medium">
                    · {homeScore}–{awayScore}
                  </span>
                )}
              </div>
              {isFinished && correct && (
                <span className={`text-sm font-extrabold ${wonPts >= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  +{wonPts} נק׳
                </span>
              )}
            </div>
            {isFinished && correct && wonPts >= 3 && (
              <p className="text-xs text-amber-700 font-semibold">
                🌟 תוצאה מדויקת! בונוס נקודות!
              </p>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="px-4 pb-4">
        <p className="text-center text-sm text-slate-400 py-1">
          {match.status === 'live' ? '🔴 המשחק כבר התחיל' : '🔒 ההגשות נסגרו'}
        </p>
      </div>
    )
  }

  /* ---------- card ---------- */
  return (
    <div
      ref={cardRef}
      className={`match-card relative bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md ${celebClass}`}
    >
      {/* Floating badge */}
      {showFloat && (
        <FloatingBadge
          pts={userBet?.points_earned ?? 1}
          onDone={() => setShowFloat(false)}
        />
      )}

      {/* Top strip */}
      <div className={`h-1.5 w-full ${STRIP_CLS[match.status] ?? STRIP_CLS.upcoming}`} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <span className="text-[12px] text-slate-400 font-medium">{fmtDate(match.match_date)}</span>
        <div className="flex items-center gap-2">
          {match.group_name && (
            <span className="text-[11px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
              בית {match.group_name}
            </span>
          )}
          {match.is_locked && (
            <span className="text-[11px] bg-amber-100 text-amber-600 font-semibold px-2 py-0.5 rounded-full">🔒</span>
          )}
          <StatusBadge status={match.status} />
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between px-4 py-6 gap-2">
        <TeamBlock name={match.home_team} label="בית" />

        {/* Centre */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
          {isFinished && match.home_score != null ? (
            <>
              <div className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-inner shadow-black/20">
                <span className="text-2xl font-black tabular-nums tracking-tight">
                  {match.home_score}–{match.away_score}
                </span>
              </div>
              {match.result && (
                <span className="text-[11px] text-slate-400 font-medium">
                  {BET_CFG[match.result]?.label}
                </span>
              )}
            </>
          ) : match.status === 'live' ? (
            <div className="bg-red-500 text-white px-4 py-1.5 rounded-xl shadow-md shadow-red-300/50">
              <span className="text-xs font-black tracking-widest">חי</span>
            </div>
          ) : (
            <div className="bg-white border-2 border-slate-200 px-4 py-1.5 rounded-xl">
              <span className="text-sm font-black text-slate-300 tracking-[0.2em]">VS</span>
            </div>
          )}
        </div>

        <TeamBlock name={match.away_team} label="אורח" />
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100" />

      {/* Bet section */}
      <div className="pt-3">
        {renderBettingSection()}
      </div>
    </div>
  )
}
