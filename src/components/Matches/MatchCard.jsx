import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import FlagImg from '../UI/FlagImg'

/* ── Config ──────────────────────────────────────────────── */
const BET_CFG = {
  home: {
    label: 'ניצחון בית',  icon: '🏠',
    idle:   'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:border-sky-300',
    active: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-transparent shadow-lg shadow-sky-300/40',
  },
  draw: {
    label: 'תיקו',         icon: '🤝',
    idle:   'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300',
    active: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-transparent shadow-lg shadow-amber-300/40',
  },
  away: {
    label: 'ניצחון אורח', icon: '✈️',
    idle:   'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300',
    active: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white border-transparent shadow-lg shadow-violet-300/40',
  },
}

const STRIP_CLS = {
  upcoming: 'bg-gradient-to-r from-emerald-400 to-teal-400',
  live:     'bg-gradient-to-r from-red-400 to-rose-500',
  finished: 'bg-gradient-to-r from-slate-300 to-slate-400',
}

/* ── Helpers ─────────────────────────────────────────────── */
/** Israel date+time — stored with +03 offset, shown as-is */
function israelDateTime(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/**
 * Broadcast channel pills derived from match.broadcast column:
 *   'כאן 11' → כאן 11 + כאן BOX
 *   'BOX'    → כאן BOX + ספורט 1
 *   null/other → כאן BOX + ספורט 1 (safe fallback)
 */
function broadcastChannels(broadcast) {
  return broadcast === 'כאן 11'
    ? ['כאן 11', 'כאן BOX']
    : ['כאן BOX', 'ספורט 1']
}

function validateScore(pred, hs, as_, homeTeam, awayTeam) {
  if (hs === '' && as_ === '') return null
  if (hs === '' || as_ === '') return null   // mid-typing — silent
  const h = parseInt(hs, 10), a = parseInt(as_, 10)
  if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return 'מספרים חיוביים בלבד (0-99)'
  if (!pred) return null
  if (pred === 'home' && h <= a) return `לניצחון ${homeTeam}: סכור הבית חייב להיות גבוה יותר`
  if (pred === 'away' && a <= h) return `לניצחון ${awayTeam}: סכור האורח חייב להיות גבוה יותר`
  if (pred === 'draw' && h !== a) return 'לתיקו — שני הסכורים חייבים להיות שווים'
  return null
}
function isSaveBlocked(pred, hs, as_, homeTeam, awayTeam) {
  if (hs === '' && as_ === '') return false
  if (hs === '' || as_ === '') return true
  return validateScore(pred, hs, as_, homeTeam, awayTeam) !== null
}

/* ── Community odds bar ──────────────────────────────────── */
function CommunityBar({ stats, isLocked }) {
  if (!stats) return null
  const total = (stats.home_count || 0) + (stats.draw_count || 0) + (stats.away_count || 0)
  if (total === 0) return null

  const pct = n => Math.round(((n || 0) / total) * 100)
  const hp = pct(stats.home_count), dp = pct(stats.draw_count), ap = pct(stats.away_count)

  return (
    <div className="px-4 pb-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          {isLocked
            ? `👥 ניחושי הקהילה · ${total} משתתפים`
            : `📊 יחס ניחושים · ${total} משתתפים`}
        </span>
      </div>
      {/* Segmented bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-slate-100">
        {hp > 0 && <div className="bg-sky-400   transition-all duration-700" style={{ width: `${hp}%` }} />}
        {dp > 0 && <div className="bg-amber-400 transition-all duration-700" style={{ width: `${dp}%` }} />}
        {ap > 0 && <div className="bg-violet-400 transition-all duration-700" style={{ width: `${ap}%` }} />}
      </div>
      {/* Labels */}
      <div className="flex justify-between text-[10px]">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
          <span className="font-bold text-slate-700">{hp}%</span>
          {isLocked && <span className="text-slate-400">בית</span>}
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          <span className="font-bold text-slate-700">{dp}%</span>
          {isLocked && <span className="text-slate-400">תיקו</span>}
        </div>
        <div className="flex items-center gap-1">
          {isLocked && <span className="text-slate-400">אורח</span>}
          <span className="font-bold text-slate-700">{ap}%</span>
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
        </div>
      </div>
    </div>
  )
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
export default function MatchCard({ match, userBet, onBetPlaced, communityStats }) {
  const { user } = useAuth()

  // ── Live clock for auto-lock countdown ───────────────────
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const matchMs = new Date(match.match_date).getTime()
    const remaining = matchMs - Date.now()
    if (remaining <= 0) return
    const interval = remaining < 3_600_000 ? 10_000 : 60_000
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [match.match_date])

  const matchMs      = new Date(match.match_date).getTime()
  const msToKickoff  = matchMs - now
  const minsToKick   = Math.floor(msToKickoff / 60_000)

  // Feature 1: auto-lock 10 min before kickoff
  const isAutoLocked  = match.status === 'upcoming' && minsToKick > 0 && minsToKick <= 10
  const isCountdown   = match.status === 'upcoming' && !match.is_locked && minsToKick > 10 && minsToKick <= 60
  const isBettingOpen = match.status === 'upcoming' && !match.is_locked && !isAutoLocked && msToKickoff > 0
  const isLocked      = match.is_locked || isAutoLocked || match.status !== 'upcoming'
  const isFinished    = match.status === 'finished'

  // ── Bet state ─────────────────────────────────────────────
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

  useEffect(() => {
    if (!isBettingOpen) {
      setPred(userBet?.prediction ?? null)
      setHomeScore(userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : '')
      setAwayScore(userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : '')
    }
  }, [userBet, isBettingOpen])

  useEffect(() => {
    if (isFinished && userBet?.is_correct && !didCelebrate.current) {
      didCelebrate.current = true
      const cls = (userBet.points_earned ?? 0) >= 3 ? 'score-celebrate' : 'win-celebrate'
      setCelebClass(cls)
      setShowFloat(true)
      setTimeout(() => setCelebClass(''), 2500)
    }
  }, [isFinished, userBet?.is_correct, userBet?.points_earned])

  const scoreErr   = validateScore(pred, homeScore, awayScore, match.home_team, match.away_team)
  const saveBlocked = isSaveBlocked(pred, homeScore, awayScore, match.home_team, match.away_team)

  async function saveBet() {
    if (!pred) { setError('בחר תחילה מי ינצח'); return }
    if (saveBlocked) { setError(scoreErr ?? 'הזן ניחוש סכור לשתי הקבוצות'); return }
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

  /* ── Betting section renderer ────────────────────────────── */
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
            {['home', 'draw', 'away'].map(key => {
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

        {/* Step 2 */}
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
                  type="number" min="0" max="20" value={homeScore}
                  onChange={e => handleScoreChange('home', e.target.value)}
                  placeholder="0"
                  className="score-input w-full text-center text-2xl font-extrabold bg-white border-2 border-slate-200 focus:border-emerald-400 rounded-xl p-2 outline-none transition-colors"
                />
              </div>
              <div className="text-slate-300 font-black text-xl flex-shrink-0 mt-4">—</div>
              <div className="flex-1 text-center">
                <div className="text-[11px] text-slate-500 mb-1 truncate">{match.away_team}</div>
                <input
                  type="number" min="0" max="20" value={awayScore}
                  onChange={e => handleScoreChange('away', e.target.value)}
                  placeholder="0"
                  className="score-input w-full text-center text-2xl font-extrabold bg-white border-2 border-slate-200 focus:border-emerald-400 rounded-xl p-2 outline-none transition-colors"
                />
              </div>
            </div>
            {scoreErr && <p className="text-red-500 text-xs mt-1.5 text-center">{scoreErr}</p>}
          </div>
        )}

        {error && <p className="text-red-500 text-xs text-center">{error}</p>}

        {pred && (
          <button
            onClick={saveBet}
            disabled={saving || saveBlocked}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-emerald-300/40 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> שומר...</>
              : justSaved ? '✅ נשמר!'
              : '🎯 שמור ניחוש'}
          </button>
        )}

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

    // Closed — show saved bet
    if (pred) {
      const wonPts  = userBet?.points_earned ?? 0
      const correct = userBet?.is_correct
      const cfg     = BET_CFG[pred]
      return (
        <div className="px-4 pb-3">
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
                  <span className="text-slate-500 font-medium">· {homeScore}–{awayScore}</span>
                )}
              </div>
              {isFinished && correct && (
                <span className={`text-sm font-extrabold ${wonPts >= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  +{wonPts} נק׳
                </span>
              )}
            </div>
            {isFinished && correct && wonPts >= 3 && (
              <p className="text-xs text-amber-700 font-semibold">🌟 תוצאה מדויקת! בונוס נקודות!</p>
            )}
          </div>
        </div>
      )
    }

    // No bet placed + betting closed
    return (
      <div className="px-4 pb-3">
        <p className="text-center text-sm text-slate-400 py-1">
          {match.status === 'live' ? '🔴 המשחק כבר התחיל'
            : isAutoLocked ? '🔒 ההגשות ננעלו'
            : '🔒 ההגשות נסגרו'}
        </p>
      </div>
    )
  }

  /* ── Card ────────────────────────────────────────────────── */
  return (
    <div className={`match-card relative bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md ${celebClass}`}>
      {showFloat && (
        <FloatingBadge pts={userBet?.points_earned ?? 1} onDone={() => setShowFloat(false)} />
      )}

      {/* Top colour strip */}
      <div className={`h-1.5 w-full ${STRIP_CLS[match.status] ?? STRIP_CLS.upcoming}`} />

      {/* ── Header: Israel time + broadcast channels ─────── */}
      <div className="px-4 pt-2.5 pb-2 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Israel date + time */}
          <div className="min-w-0">
            <div className="text-[12px] text-slate-700 font-semibold tabular-nums leading-snug">
              🕐 {israelDateTime(match.match_date)}
            </div>
          </div>
          {/* Right: badges */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
            {match.group_name && (
              <span className="text-[11px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                בית {match.group_name}
              </span>
            )}
            {(match.is_locked || isAutoLocked) && (
              <span className="text-[11px] bg-amber-100 text-amber-600 font-semibold px-2 py-0.5 rounded-full">🔒</span>
            )}
            <StatusBadge status={match.status} />
          </div>
        </div>

        {/* Broadcast channels — per-match from DB */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-300">📺</span>
          {broadcastChannels(match.broadcast).map(ch => (
            <span
              key={ch}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                ch === 'כאן 11'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : ch === 'כאן BOX'
                    ? 'bg-sky-50 text-sky-600 border-sky-100'
                    : 'bg-orange-50 text-orange-600 border-orange-100'
              }`}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>

      {/* ── Feature 1: Countdown / auto-lock banners ─────── */}
      {isCountdown && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center gap-2">
          <span className="text-amber-500 animate-pulse">⏰</span>
          <span className="text-xs font-bold text-amber-700">
            נסגר בעוד {minsToKick} {minsToKick === 1 ? 'דקה' : 'דקות'} — הזדרז לנחש!
          </span>
        </div>
      )}
      {isAutoLocked && (
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-1.5 flex items-center gap-2">
          <span className="text-rose-500">🔒</span>
          <span className="text-xs font-bold text-rose-700">
            ההימור ננעל — המשחק מתחיל תוך כ-{minsToKick} {minsToKick === 1 ? 'דקה' : 'דקות'}
          </span>
        </div>
      )}

      {/* ── Teams ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-6 gap-2">
        <TeamBlock name={match.home_team} label="בית" />

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

      {/* ── Betting section ─────────────────────────────────── */}
      <div className="border-t border-slate-100 pt-3">
        {renderBettingSection()}
      </div>

      {/* ── Features 3 + 4: Community odds bar ──────────────── */}
      {communityStats && (
        <>
          <div className="mx-4 border-t border-slate-100" />
          <CommunityBar stats={communityStats} isLocked={isLocked || isFinished} />
        </>
      )}
    </div>
  )
}
