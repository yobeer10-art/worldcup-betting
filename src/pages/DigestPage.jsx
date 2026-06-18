import { useCallback, useEffect, useState } from 'react'
import { supabase }     from '../lib/supabase'
import Header           from '../components/Layout/Header'
import FlagImg          from '../components/UI/FlagImg'
import Spinner          from '../components/UI/Spinner'

/* ── Israel timezone helpers ──────────────────────────────────── */
function israelToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function hebrewDayLabel(dateStr) {
  return new Date(`${dateStr}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long',
  })
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00+03:00`)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}

/* ── Pick config ──────────────────────────────────────────────── */
const PICK = {
  home: { label: 'בית',  icon: '🏠', bg: 'bg-sky-100 text-sky-700 border-sky-200' },
  draw: { label: 'תיקו', icon: '🤝', bg: 'bg-amber-100 text-amber-700 border-amber-200' },
  away: { label: 'אורח', icon: '✈️', bg: 'bg-violet-100 text-violet-700 border-violet-200' },
}

/* ── Avatar color from user_id hash ──────────────────────────── */
const AVATAR_COLORS = [
  'bg-emerald-500','bg-sky-500','bg-violet-500','bg-rose-500',
  'bg-amber-500','bg-teal-500','bg-indigo-500','bg-pink-500',
  'bg-cyan-500','bg-orange-500',
]
function avatarColor(uid) {
  let h = 0
  for (let i = 0; i < (uid?.length ?? 0); i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2)
}

/* ── Broadcast chips ──────────────────────────────────────────── */
function BroadcastChips({ broadcast }) {
  const channels = broadcast === 'כאן 11' ? ['כאן 11', 'BOX'] : ['BOX', 'ספורט 1']
  return (
    <div className="flex gap-1">
      {channels.map(ch => (
        <span key={ch} className={`text-[9px] font-semibold px-1.5 py-px rounded border leading-none ${
          ch === 'כאן 11' ? 'bg-blue-50 text-blue-600 border-blue-200'
            : ch === 'BOX' ? 'bg-sky-50 text-sky-600 border-sky-100'
            : 'bg-orange-50 text-orange-600 border-orange-100'
        }`}>{ch}</span>
      ))}
    </div>
  )
}

/* ── Single bet row ───────────────────────────────────────────── */
function BetRow({ bet, isFinished }) {
  const name   = bet.users?.display_name ?? 'שחקן'
  const pick   = PICK[bet.prediction]
  const hasScore = bet.predicted_home_score != null && bet.predicted_away_score != null

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0">
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center
                       text-white text-[10px] font-extrabold shrink-0 ${avatarColor(bet.user_id)}`}>
        {initials(name)}
      </div>

      {/* Name */}
      <span className="text-xs font-semibold text-slate-700 flex-1 min-w-0 truncate">{name}</span>

      {/* Exact score */}
      {hasScore && (
        <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
          {bet.predicted_home_score}–{bet.predicted_away_score}
        </span>
      )}

      {/* Pick badge */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${pick?.bg}`}>
        {pick?.icon} {pick?.label}
      </span>

      {/* Result (finished) */}
      {isFinished && (
        <div className="shrink-0 flex items-center gap-1">
          {bet.is_correct === true ? (
            <span className={`text-[11px] font-extrabold ${
              (bet.points_earned ?? 0) >= 3 ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              {(bet.points_earned ?? 0) >= 3 ? '🌟' : '✅'} +{bet.points_earned}
            </span>
          ) : bet.is_correct === false ? (
            <span className="text-[11px] text-rose-400 font-bold">❌ 0</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ── Match digest card ────────────────────────────────────────── */
function MatchDigestCard({ match, bets, isToday }) {
  const isFinished = match.status === 'finished'
  const betCount   = bets.length
  const [open, setOpen] = useState(true)

  /* Sort: if finished, winning bets first; otherwise by prediction */
  const sorted = [...bets].sort((a, b) => {
    if (isFinished) {
      const pa = (a.points_earned ?? 0), pb = (b.points_earned ?? 0)
      return pb - pa
    }
    const order = { home: 0, draw: 1, away: 2 }
    return (order[a.prediction] ?? 9) - (order[b.prediction] ?? 9)
  })

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm
                     ${isToday ? 'border-2 border-emerald-200' : 'border border-slate-200'}`}>

      {/* Colour strip */}
      <div className={`h-1 ${isToday
        ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
        : 'bg-gradient-to-r from-sky-300 to-indigo-300'}`} />

      {/* Match header */}
      <div
        className="px-4 pt-3 pb-2.5 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {/* Top row: time + broadcast + bet count */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 tabular-nums">
              🕐 {israelTime(match.match_date)}
            </span>
            <BroadcastChips broadcast={match.broadcast} />
            {isFinished && (
              <span className="text-[9px] font-bold bg-slate-700 text-white px-1.5 py-px rounded-full">הסתיים</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              betCount > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400'
            }`}>
              {betCount} הימורים
            </span>
            <span className="text-slate-300 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Teams row */}
        <div className="flex items-center justify-between gap-2">
          {/* Home */}
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <FlagImg team={match.home_team} size="md" />
            <span className="text-xs font-bold text-slate-800 text-center leading-tight line-clamp-2">
              {match.home_team}
            </span>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-0.5 shrink-0 px-2">
            {isFinished && match.home_score != null ? (
              <div className="bg-slate-900 text-white text-base font-black px-3 py-1.5 rounded-xl tabular-nums">
                {match.home_score}–{match.away_score}
              </div>
            ) : (
              <div className="text-slate-300 text-lg font-black">VS</div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <FlagImg team={match.away_team} size="md" />
            <span className="text-xs font-bold text-slate-800 text-center leading-tight line-clamp-2">
              {match.away_team}
            </span>
          </div>
        </div>
      </div>

      {/* Bet list */}
      {open && (
        <div className="border-t border-slate-100 px-4">
          {sorted.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">אין הימורים עדיין</p>
          ) : (
            <div>
              {sorted.map(bet => (
                <BetRow key={bet.id} bet={bet} isFinished={isFinished} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
export default function DigestPage() {
  const [matches,  setMatches]  = useState([])
  const [betsByMatch, setBetsByMatch] = useState({})
  const [loading,  setLoading]  = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)

    const today    = israelToday()
    const tomorrow = addDays(today, 1)

    /* Fetch today + tomorrow matches */
    const todayStartUTC    = new Date(`${today}T00:00:00+03:00`).toISOString()
    const tomorrowEndUTC   = new Date(`${tomorrow}T23:59:59+03:00`).toISOString()

    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .gte('match_date', todayStartUTC)
      .lte('match_date', tomorrowEndUTC)
      .order('match_date')

    const matches = matchData ?? []
    setMatches(matches)

    if (matches.length === 0) { setLoading(false); return }

    /* Fetch all bets for those matches, joined with user names */
    const ids = matches.map(m => m.id)
    const { data: betsData } = await supabase
      .from('bets')
      .select('id, match_id, prediction, predicted_home_score, predicted_away_score, is_correct, points_earned, user_id, users(display_name)')
      .in('match_id', ids)
      .order('created_at', { ascending: true })

    const bm = {}
    for (const b of betsData ?? []) {
      if (!bm[b.match_id]) bm[b.match_id] = []
      bm[b.match_id].push(b)
    }
    setBetsByMatch(bm)

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Split today vs tomorrow ─────────────────────────────── */
  const today    = israelToday()
  const tomorrow = addDays(today, 1)

  const todayMatches    = matches.filter(m => israelDate(m.match_date) === today)
  const tomorrowMatches = matches.filter(m => israelDate(m.match_date) === tomorrow)

  /* ── Total bet count summary ─────────────────────────────── */
  const totalBets  = Object.values(betsByMatch).reduce((s, arr) => s + arr.length, 0)

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-5 pb-28 space-y-6" dir="rtl">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">👥 ריכוז הימורים</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            היום ומחר · {totalBets > 0 ? `${totalBets} הימורים בסך הכל` : 'ממתין להימורים'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : matches.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">⚽</div>
            <p className="text-slate-500 font-semibold">אין משחקים היום ומחר</p>
          </div>
        ) : (
          <>
            {/* TODAY */}
            {todayMatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-emerald-200" />
                  <div className="flex items-center gap-1.5 bg-emerald-500 text-white
                                  text-xs font-extrabold px-3 py-1 rounded-full shadow-sm shadow-emerald-300/40">
                    <span className="animate-pulse">🟢</span>
                    <span>היום · {hebrewDayLabel(today)}</span>
                  </div>
                  <div className="flex-1 h-px bg-emerald-200" />
                </div>

                {todayMatches.map(m => (
                  <MatchDigestCard
                    key={m.id}
                    match={m}
                    bets={betsByMatch[m.id] ?? []}
                    isToday
                  />
                ))}
              </section>
            )}

            {/* TOMORROW */}
            {tomorrowMatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-sky-200" />
                  <div className="flex items-center gap-1.5 bg-sky-500 text-white
                                  text-xs font-extrabold px-3 py-1 rounded-full shadow-sm shadow-sky-300/40">
                    <span>📅</span>
                    <span>מחר · {hebrewDayLabel(tomorrow)}</span>
                  </div>
                  <div className="flex-1 h-px bg-sky-200" />
                </div>

                {tomorrowMatches.map(m => (
                  <MatchDigestCard
                    key={m.id}
                    match={m}
                    bets={betsByMatch[m.id] ?? []}
                    isToday={false}
                  />
                ))}
              </section>
            )}
          </>
        )}

      </main>
    </>
  )
}
