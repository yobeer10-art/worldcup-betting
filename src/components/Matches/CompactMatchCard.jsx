import { useEffect, useRef, useState } from 'react'
import { Link }   from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import FlagImg from '../UI/FlagImg'

/* ── Config ──────────────────────────────────────────────────── */
const BET = {
  home: { label: 'בית',  icon: '🏠', activeClass: 'bg-sky-500 text-white border-sky-500' },
  draw: { label: 'תיקו', icon: '🤝', activeClass: 'bg-amber-400 text-white border-amber-400' },
  away: { label: 'אורח', icon: '✈️', activeClass: 'bg-violet-500 text-white border-violet-500' },
}

const KO_STAGES = new Set(['round_of_32','round_of_16','quarter','semi','third_place','final'])

// From the semis onward the stakes rise: advance 3pts, exact score 5pts
export function koPoints(stage) {
  return ['semi','third_place','final'].includes(stage)
    ? { adv: 3, score: 5 }
    : { adv: 2, score: 3 }
}

/* ── Helpers ─────────────────────────────────────────────────── */
function israelTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function broadcastChannels(broadcast) {
  return broadcast === 'כאן 11' ? ['כאן 11', 'BOX'] : ['BOX', 'ספורט 1']
}

/* ═══════════════════════════════════════════════════════════════ */
export default function CompactMatchCard({ match, userBet, communityStats, onBetPlaced, isToday }) {
  const { user } = useAuth()
  const isKnockout = KO_STAGES.has(match.stage)

  /* ── Auto-lock countdown ──────────────────────────────────── */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const ms = new Date(match.match_date).getTime()
    const remaining = ms - Date.now()
    if (remaining <= 0) return
    const interval = remaining < 3_600_000 ? 10_000 : 60_000
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [match.match_date])

  const matchMs      = new Date(match.match_date).getTime()
  const msToKickoff  = matchMs - now
  const minsToKick   = Math.floor(msToKickoff / 60_000)
  const isAutoLocked = match.status === 'upcoming' && minsToKick > 0 && minsToKick <= 5
  const isBettingOpen= match.status === 'upcoming' && !match.is_locked && !isAutoLocked && msToKickoff > 0
  const isLocked     = match.is_locked || isAutoLocked || match.status !== 'upcoming'
  const isFinished   = match.status === 'finished'

  /* ── Group-stage bet state ────────────────────────────────── */
  const [pred,      setPred]      = useState(userBet?.prediction ?? null)
  const [homeScore, setHomeScore] = useState(
    userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : ''
  )
  const [awayScore, setAwayScore] = useState(
    userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : ''
  )
  const [scoreOpen, setScoreOpen] = useState(false)
  const [scoreErr,  setScoreErr]  = useState(null)

  /* ── Knockout bet state ───────────────────────────────────── */
  const [advancePick,  setAdvancePick]  = useState(userBet?.advance_pick ?? null)
  const [koHomeScore,  setKoHomeScore]  = useState(
    userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : ''
  )
  const [koAwayScore,  setKoAwayScore]  = useState(
    userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : ''
  )

  /* ── Shared state ─────────────────────────────────────────── */
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    if (!isBettingOpen) {
      setPred(userBet?.prediction ?? null)
      setHomeScore(userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : '')
      setAwayScore(userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : '')
      setAdvancePick(userBet?.advance_pick ?? null)
      setKoHomeScore(userBet?.predicted_home_score != null ? String(userBet.predicted_home_score) : '')
      setKoAwayScore(userBet?.predicted_away_score != null ? String(userBet.predicted_away_score) : '')
    }
  }, [userBet, isBettingOpen])

  /* ── Group-stage: score auto-sets winner ─────────────────── */
  function handleScoreChange(side, value) {
    const hs  = side === 'home' ? value : homeScore
    const as_ = side === 'away' ? value : awayScore
    if (side === 'home') setHomeScore(value)
    else                 setAwayScore(value)
    const h = parseInt(hs, 10), a = parseInt(as_, 10)
    if (!isNaN(h) && !isNaN(a)) {
      if      (h > a) setPred('home')
      else if (a > h) setPred('away')
      else            setPred('draw')
    }
  }

  /* ── Save group-stage bet ────────────────────────────────── */
  async function saveGroupBet() {
    if (!pred || saving) return
    const bothEmpty = homeScore === '' && awayScore === ''
    const hsVal = bothEmpty ? null : (homeScore !== '' ? parseInt(homeScore, 10) : 0)
    const asVal = bothEmpty ? null : (awayScore !== '' ? parseInt(awayScore, 10) : 0)
    if (hsVal !== null) {
      if (pred === 'home' && hsVal <= asVal) {
        setScoreErr(`לניצחון ${match.home_team}: הסכור (${hsVal}–${asVal}) לא מתאים`); return
      }
      if (pred === 'away' && asVal <= hsVal) {
        setScoreErr(`לניצחון ${match.away_team}: הסכור (${hsVal}–${asVal}) לא מתאים`); return
      }
      if (pred === 'draw' && hsVal !== asVal) {
        setScoreErr(`לתיקו — שני הסכורים חייבים להיות שווים`); return
      }
    }
    setScoreErr(null)
    setSaving(true)
    const { error } = await supabase.from('bets').upsert(
      { user_id: user.id, match_id: match.id, prediction: pred,
        predicted_home_score: hsVal, predicted_away_score: asVal },
      { onConflict: 'user_id,match_id' }
    )
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); onBetPlaced?.() }
  }

  /* ── Save knockout bet ───────────────────────────────────── */
  async function saveKoBet() {
    if (!advancePick || saving) return
    const bothEmpty = koHomeScore === '' && koAwayScore === ''
    const hsVal = bothEmpty ? null : (koHomeScore !== '' ? parseInt(koHomeScore, 10) : 0)
    const asVal = bothEmpty ? null : (koAwayScore !== '' ? parseInt(koAwayScore, 10) : 0)
    if (hsVal !== null && (isNaN(hsVal) || isNaN(asVal) || hsVal < 0 || asVal < 0)) {
      return
    }
    // prediction field mirrors advance pick direction for community stats
    const predDir = advancePick === match.home_team ? 'home' : 'away'
    setSaving(true)
    const { error } = await supabase.from('bets').upsert(
      { user_id: user.id, match_id: match.id,
        advance_pick: advancePick,
        prediction: predDir,
        predicted_home_score: hsVal,
        predicted_away_score: asVal },
      { onConflict: 'user_id,match_id' }
    )
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); onBetPlaced?.() }
  }

  /* ── Community bar ───────────────────────────────────────── */
  const total = communityStats
    ? (communityStats.home_count || 0) + (communityStats.draw_count || 0) + (communityStats.away_count || 0)
    : 0
  const pct = n => total > 0 ? Math.round(((n || 0) / total) * 100) : 0
  const hp = pct(communityStats?.home_count)
  const dp = pct(communityStats?.draw_count)
  const ap = pct(communityStats?.away_count)

  /* ── Card border ─────────────────────────────────────────── */
  const cardBorder = isToday
    ? 'border-2 border-emerald-300 shadow-md shadow-emerald-100/60'
    : 'border border-slate-200 shadow-sm'

  /* ── Points helpers (knockout result display) ────────────── */
  const koAdvPts   = userBet?.advance_points ?? 0
  const koScorePts = isFinished ? (userBet?.points_earned ?? 0) - koAdvPts : 0

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className={`bg-white rounded-2xl overflow-hidden flex flex-col ${cardBorder}`}>

      {/* Today strip */}
      {isToday && <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />}

      {/* Knockout stage pill */}
      {isKnockout && (
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[9px] font-extrabold text-white/90 uppercase tracking-wide">
            ⚔️ נוקאאוט
          </span>
        </div>
      )}

      {/* Header: time + status */}
      <div className={`px-2.5 pt-2 pb-1.5 flex items-center justify-between gap-1
                       ${isToday ? 'bg-emerald-50/60' : 'bg-slate-50/80'}`}>
        <span className="text-[10px] font-bold text-slate-600 tabular-nums">
          🕐 {israelTime(match.match_date)}
        </span>
        <div className="flex items-center gap-1">
          {broadcastChannels(match.broadcast).map(ch => (
            <span key={ch} className={`text-[9px] font-semibold px-1 py-px rounded border leading-none ${
              ch === 'כאן 11' ? 'bg-blue-50 text-blue-600 border-blue-200'
                : ch === 'BOX' ? 'bg-sky-50 text-sky-600 border-sky-100'
                : 'bg-orange-50 text-orange-600 border-orange-100'
            }`}>{ch}</span>
          ))}
          {isFinished && (
            <span className="text-[9px] bg-slate-700 text-white px-1.5 py-px rounded-full font-semibold">הסתיים</span>
          )}
          {match.status === 'live' && (
            <span className="text-[9px] bg-red-500 text-white px-1.5 py-px rounded-full font-semibold">חי</span>
          )}
          {(match.is_locked || isAutoLocked) && match.status === 'upcoming' && (
            <span className="text-[9px] text-amber-600">🔒</span>
          )}
        </div>
      </div>

      {/* Teams + score */}
      <div className="px-2 py-2.5 flex items-center justify-between gap-1">
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <FlagImg team={match.home_team} size="sm" />
          <span className="text-[9px] font-bold text-slate-700 text-center leading-tight line-clamp-2 w-full">
            {match.home_team}
          </span>
          <span className="text-[8px] text-slate-400">בית</span>
        </div>
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 px-1">
          {isFinished && match.home_score != null ? (
            <div className="bg-slate-900 text-white text-sm font-black px-2 py-1 rounded-lg tabular-nums">
              {match.home_score}–{match.away_score}
            </div>
          ) : match.status === 'live' ? (
            <div className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg">חי</div>
          ) : (
            <div className="text-slate-300 text-xs font-black">VS</div>
          )}
          {isToday && match.status === 'upcoming' && minsToKick > 0 && minsToKick <= 30 && (
            <span className="text-[8px] text-amber-500 font-bold">{minsToKick}ד׳</span>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <FlagImg team={match.away_team} size="sm" />
          <span className="text-[9px] font-bold text-slate-700 text-center leading-tight line-clamp-2 w-full">
            {match.away_team}
          </span>
          <span className="text-[8px] text-slate-400">אורח</span>
        </div>
      </div>

      {/* ── Betting area ───────────────────────────────────── */}
      <div className="border-t border-slate-100 px-2 pt-2 pb-2 flex-1 flex flex-col gap-1.5">
        {!user ? (
          <Link to="/auth" className="text-[10px] text-emerald-600 font-semibold text-center block py-1">
            התחבר להמר
          </Link>

        ) : isKnockout ? (
          /* ══════════ KNOCKOUT BETTING UI ══════════ */
          isBettingOpen ? (
            <KnockoutBetOpen
              match={match}
              advancePick={advancePick}
              setAdvancePick={setAdvancePick}
              koHomeScore={koHomeScore} setKoHomeScore={setKoHomeScore}
              koAwayScore={koAwayScore} setKoAwayScore={setKoAwayScore}
              saving={saving} saved={saved}
              onSave={saveKoBet}
              userBet={userBet}
            />
          ) : (
            <KnockoutBetClosed
              match={match}
              userBet={userBet}
              isFinished={isFinished}
              isAutoLocked={isAutoLocked}
              advancePick={advancePick}
              koHomeScore={koHomeScore}
              koAwayScore={koAwayScore}
              koAdvPts={koAdvPts}
              koScorePts={koScorePts}
            />
          )

        ) : (
          /* ══════════ GROUP-STAGE BETTING UI (unchanged) ══════════ */
          isBettingOpen ? (
            <>
              <div className="grid grid-cols-3 gap-1">
                {['home', 'draw', 'away'].map(key => {
                  const cfg    = BET[key]
                  const active = pred === key
                  return (
                    <button
                      key={key}
                      onClick={() => { setPred(key); setScoreOpen(true) }}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[9px] font-bold
                                  transition-all duration-150 active:scale-95 ${
                        active ? cfg.activeClass : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm leading-none">{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>

              {pred && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setScoreOpen(o => !o)}
                    className="text-[9px] text-slate-400 hover:text-amber-500 font-semibold shrink-0"
                  >
                    {scoreOpen ? '▲' : '▼'} תוצאה
                  </button>
                  {scoreOpen && (
                    <>
                      <input
                        type="number" min="0" max="20" value={homeScore}
                        onChange={e => handleScoreChange('home', e.target.value)}
                        placeholder="0"
                        className="w-8 text-center text-xs font-bold border border-slate-200 rounded-md py-0.5 focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-slate-300 text-xs font-black flex-shrink-0">—</span>
                      <input
                        type="number" min="0" max="20" value={awayScore}
                        onChange={e => handleScoreChange('away', e.target.value)}
                        placeholder="0"
                        className="w-8 text-center text-xs font-bold border border-slate-200 rounded-md py-0.5 focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-[8px] text-amber-500 font-bold shrink-0">+2נק׳</span>
                    </>
                  )}
                </div>
              )}

              {scoreErr && (
                <p className="text-[9px] text-rose-500 font-semibold text-center leading-tight">{scoreErr}</p>
              )}

              {pred && (
                <button
                  onClick={saveGroupBet}
                  disabled={saving}
                  className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-extrabold
                             rounded-lg transition-colors active:scale-[0.98] disabled:opacity-60"
                >
                  {saving ? '...' : saved ? '✅ נשמר!' : '🎯 שמור'}
                </button>
              )}

              {!saved && userBet?.prediction && pred === userBet.prediction && (
                <p className="text-[8px] text-slate-400 text-center">
                  ניחוש קודם: {BET[userBet.prediction]?.icon}
                  {userBet.predicted_home_score != null && ` · ${userBet.predicted_home_score}–${userBet.predicted_away_score}`}
                </p>
              )}
            </>
          ) : (
            /* Group closed */
            pred ? (
              <div className={`rounded-lg px-2 py-1.5 text-center border ${
                !isFinished ? 'bg-slate-50 border-slate-200'
                : userBet?.is_correct
                  ? (userBet.points_earned >= 3 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300')
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <span className="text-[10px] font-semibold text-slate-600">
                  {isFinished && (userBet?.is_correct
                    ? (userBet.points_earned >= 3 ? '🌟' : '✅')
                    : userBet?.is_correct === false ? '❌' : '')}
                  {' '}{BET[pred]?.icon} {BET[pred]?.label}
                </span>
                {homeScore !== '' && (
                  <span className="text-[9px] text-slate-400 block">{homeScore}–{awayScore}</span>
                )}
                {isFinished && userBet?.is_correct && (
                  <span className={`text-[10px] font-extrabold ${
                    userBet.points_earned >= 3 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>+{userBet.points_earned}נק׳</span>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 text-center py-1">
                {isAutoLocked ? '🔒 ננעל' : match.status === 'live' ? '🔴 חי' : '—'}
              </p>
            )
          )
        )}
      </div>

      {/* Community bar */}
      {total > 0 && (
        <div className="px-2 pb-2">
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-slate-100">
            {hp > 0 && <div className="bg-sky-400"    style={{ width: `${hp}%` }} />}
            {dp > 0 && <div className="bg-amber-400"  style={{ width: `${dp}%` }} />}
            {ap > 0 && <div className="bg-violet-400" style={{ width: `${ap}%` }} />}
          </div>
          <div className="flex justify-between text-[8px] text-slate-400 mt-0.5 tabular-nums">
            <span>{hp}%</span>
            {!isKnockout && <span>{dp}%</span>}
            <span>{ap}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Knockout: open betting ──────────────────────────────────── */
function KnockoutBetOpen({
  match, advancePick, setAdvancePick,
  koHomeScore, setKoHomeScore, koAwayScore, setKoAwayScore,
  saving, saved, onSave, userBet,
}) {
  const teams = [
    { name: match.home_team, side: 'home' },
    { name: match.away_team, side: 'away' },
  ]
  const pts = koPoints(match.stage)

  return (
    <>
      {/* Bet 1: who advances */}
      <div>
        <p className="text-[9px] font-extrabold text-slate-500 mb-1 flex items-center gap-1">
          <span>⚡</span> מי עולה הלאה
          <span className="text-rose-400 font-bold">{pts.adv}נק׳</span>
        </p>
        <div className="grid grid-cols-2 gap-1">
          {teams.map(({ name }) => {
            const picked = advancePick === name
            return (
              <button
                key={name}
                onClick={() => setAdvancePick(name)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-[9px] font-bold
                            transition-all duration-150 active:scale-95 ${
                  picked
                    ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-rose-300'
                }`}
              >
                <FlagImg team={name} size="sm" />
                <span className="text-center leading-tight line-clamp-2">{name}</span>
                {picked && <span className="text-[8px] text-rose-500">✓ בחרת</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bet 2: exact 90-min score */}
      <div>
        <p className="text-[9px] font-extrabold text-slate-500 mb-1 flex items-center gap-1">
          <span>🎯</span> תוצאה מדויקת (90 דקות)
          <span className="text-amber-500 font-bold">{pts.score}נק׳</span>
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="number" min="0" max="20" value={koHomeScore}
            onChange={e => setKoHomeScore(e.target.value)}
            placeholder="0"
            className="w-9 text-center text-xs font-bold border border-slate-200 rounded-lg py-1
                       focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
          />
          <span className="text-slate-300 font-black text-xs">—</span>
          <input
            type="number" min="0" max="20" value={koAwayScore}
            onChange={e => setKoAwayScore(e.target.value)}
            placeholder="0"
            className="w-9 text-center text-xs font-bold border border-slate-200 rounded-lg py-1
                       focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
          />
          <span className="text-[8px] text-slate-400 leading-tight">
            כולל תיקו<br />בסיום 90ד׳
          </span>
        </div>
      </div>

      {/* Save */}
      {advancePick && (
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-extrabold
                     rounded-lg transition-colors active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? '...' : saved ? '✅ נשמר!' : '🎯 שמור הימור'}
        </button>
      )}

      {!saved && userBet?.advance_pick && (
        <p className="text-[8px] text-slate-400 text-center">
          ניחוש קודם: {userBet.advance_pick}
          {userBet.predicted_home_score != null && ` · ${userBet.predicted_home_score}–${userBet.predicted_away_score}`}
        </p>
      )}
    </>
  )
}

/* ── Knockout: closed / finished ─────────────────────────────── */
function KnockoutBetClosed({
  match, userBet, isFinished, isAutoLocked,
  advancePick, koHomeScore, koAwayScore,
  koAdvPts, koScorePts,
}) {
  if (!advancePick) {
    return (
      <p className="text-[10px] text-slate-400 text-center py-1">
        {isAutoLocked ? '🔒 ננעל' : isFinished ? '—' : '🔒'}
      </p>
    )
  }

  const advCorrect = isFinished && koAdvPts > 0
  const advWrong   = isFinished && userBet?.is_correct === false
  const hasScore   = koHomeScore !== '' && koAwayScore !== ''
  const scoreCorrect = isFinished && koScorePts > 0

  return (
    <div className={`rounded-xl border px-2 py-2 space-y-1.5 ${
      !isFinished
        ? 'bg-slate-50 border-slate-200'
        : advCorrect
          ? 'bg-emerald-50 border-emerald-200'
          : advWrong
            ? 'bg-rose-50 border-rose-200'
            : 'bg-slate-50 border-slate-200'
    }`}>
      {/* Advance pick row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-400">עולה הלאה:</span>
          <FlagImg team={advancePick} size="xs" />
          <span className="text-[9px] font-bold text-slate-700 leading-tight line-clamp-1">
            {advancePick}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {isFinished && (
            <span className="text-[9px]">{advCorrect ? '✅' : '❌'}</span>
          )}
          {isFinished && advCorrect && (
            <span className="text-[9px] font-extrabold text-emerald-600">+{koAdvPts}נק׳</span>
          )}
        </div>
      </div>

      {/* Score row */}
      {hasScore && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400">90ד׳:</span>
            <span className="text-[9px] font-bold text-slate-600 tabular-nums">
              {koHomeScore}–{koAwayScore}
            </span>
          </div>
          {isFinished && (
            <div className="flex items-center gap-0.5">
              <span className="text-[9px]">{scoreCorrect ? '🌟' : '❌'}</span>
              {scoreCorrect && (
                <span className="text-[9px] font-extrabold text-amber-600">+{koScorePts}נק׳</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Total points */}
      {isFinished && (koAdvPts + koScorePts) > 0 && (
        <div className="text-center">
          <span className="text-[10px] font-extrabold text-emerald-700">
            סה״כ +{koAdvPts + koScorePts} נקודות
          </span>
        </div>
      )}
    </div>
  )
}
