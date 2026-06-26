import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'

const APP_LINK = 'worldcup-betting-rfhu.vercel.app'
const RANK_ICON = ['🥇', '🥈', '🥉']

/* ── Time helpers ─────────────────────────────────────────────── */

/** The round window: [prev 04:30 UTC, last 04:30 UTC) — = [prev 07:30 IL, last 07:30 IL) */
function roundWindow() {
  const now = new Date()
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate()
  // Most recent 04:30 UTC that has already passed
  let roundEnd = new Date(Date.UTC(y, mo, d, 4, 30, 0))
  if (roundEnd > now) roundEnd = new Date(roundEnd.getTime() - 86_400_000)
  const roundStart = new Date(roundEnd.getTime() - 86_400_000)
  return { roundStart, roundEnd }
}

function hebrewDate(date) {
  return date.toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long',
  })
}
function israelTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/* ── Helpers ──────────────────────────────────────────────────── */

function rankChangeStr(delta) {
  if (delta === null || delta === undefined) return ''
  if (delta > 0) return ` ⬆️${delta}`
  if (delta < 0) return ` ⬇️${Math.abs(delta)}`
  return ' ➡️'
}

/* ── Message builder ──────────────────────────────────────────── */

function buildMessage({ matches, betsData, ranked, stars, maxRoundPts, exactBets, upsets, hasSnapshot, roundStart }) {
  const lines = []

  // Header: label is the "evening" date (noon of round start day in IL time)
  const eveningDate = new Date(roundStart.getTime() + 12 * 3_600_000)
  const roundLabel = hebrewDate(eveningDate)

  lines.push(`🌟 *סיכום מונדיאל 2026 – ${roundLabel}* 🌟`, '')

  if (matches.length === 0) {
    lines.push('לא היו משחקים בסיבוב זה ⚽')
    lines.push('', `🔗 ${APP_LINK}`)
    return lines.join('\n')
  }

  // ── Matches played ──────────────────────────────────────────
  lines.push(`🏟 *משחקי הסיבוב* (${matches.length} משחקים):`)
  for (const m of matches) {
    lines.push(`• ${israelTime(m.match_date)} | ${m.home_team} *${m.home_score}–${m.away_score}* ${m.away_team}`)
  }
  lines.push('')

  // ── Star of the round ───────────────────────────────────────
  if (stars.length > 0) {
    lines.push('⭐ *כוכב הסיבוב*')
    const starStr = stars.length === 1 ? stars[0] : stars.slice(0, -1).join(', ') + ' ו' + stars[stars.length - 1]
    lines.push(`${starStr} עם *+${maxRoundPts} נקודות* הלילה! 🔥`, '')
  }

  // ── Exact scores (3-pointers) ───────────────────────────────
  if (exactBets.length > 0) {
    lines.push('🎯 *ניחושים מדויקים (3 נק׳)*:')
    for (const b of exactBets) {
      const m = matches.find(m => m.id === b.match_id)
      if (!m) continue
      const name = b.users?.display_name ?? 'שחקן'
      lines.push(`• ${name}: ${m.home_team} *${m.home_score}–${m.away_score}* ${m.away_team} 🌟`)
    }
    lines.push('')
  } else {
    lines.push('🎯 אף אחד לא ניחש תוצאה מדויקת הפעם', '')
  }

  // ── Upsets ─────────────────────────────────────────────────
  if (upsets.length > 0) {
    lines.push('😮 *הפתעות הסיבוב*:')
    for (const u of upsets) {
      const m = u.match
      const resultLabel = m.home_score > m.away_score ? m.home_team
        : m.away_score > m.home_score ? m.away_team : 'תיקו'
      const winnerStr = u.winners.join(', ')
      lines.push(`• ${m.home_team} נגד ${m.away_team} — רק *${u.pct}%* ניחשו ${resultLabel}`)
      lines.push(`  🏅 ${winnerStr} ניחשו נכון!`)
    }
    lines.push('')
  }

  // ── Points this round ───────────────────────────────────────
  const withPts    = ranked.filter(u => u.roundPts > 0).sort((a, b) => b.roundPts - a.roundPts)
  const withoutPts = ranked.filter(u => u.roundPts === 0)

  if (withPts.length > 0 || withoutPts.length > 0) {
    lines.push('📊 *נקודות הסיבוב*:')
    for (const u of withPts) {
      lines.push(`• ${u.display_name}: *+${u.roundPts}*`)
    }
    if (withoutPts.length > 0) {
      lines.push(`• ${withoutPts.map(u => u.display_name).join(', ')}: 0`)
    }
    lines.push('')
  }

  // ── Leaderboard ─────────────────────────────────────────────
  lines.push('🏆 *טבלה מעודכנת*:')
  for (const u of ranked) {
    const icon   = u.rank <= 3 ? RANK_ICON[u.rank - 1] : `${u.rank}.`
    const change = hasSnapshot ? rankChangeStr(u.rankChange) : ''
    lines.push(`${icon} ${u.display_name} – *${u.total_points}נק׳*${change}`)
  }

  if (!hasSnapshot) {
    lines.push('', '_סיבוב ראשון — אין נתוני השוואה קודמים_')
  }

  lines.push('', '⚽ בהצלחה אלופים! המונדיאל ממשיך! 🔥', `🔗 ${APP_LINK}`)

  return lines.join('\n')
}

/* ═══════════════════════════════════════════════════════════════ */
export default function AdminDailyRecap() {
  const [loading, setLoading] = useState(false)
  const [text,    setText]    = useState('')
  const [copied,  setCopied]  = useState(false)
  const [meta,    setMeta]    = useState(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setText('')

    const { roundStart, roundEnd } = roundWindow()

    /* ── 1. Matches in this round ─────────────────────────── */
    const { data: matchData } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_score, away_score, status, match_date')
      .eq('status', 'finished')
      .gte('match_date', roundStart.toISOString())
      .lt('match_date', roundEnd.toISOString())
      .order('match_date')

    const matches = matchData ?? []
    const matchIds = matches.map(m => m.id)

    /* ── 2. Bets on those matches ─────────────────────────── */
    const betsData = matchIds.length > 0
      ? ((await supabase
          .from('bets')
          .select('match_id, user_id, prediction, predicted_home_score, predicted_away_score, is_correct, points_earned, users(display_name)')
          .in('match_id', matchIds)
        ).data ?? [])
      : []

    /* ── 3. Current leaderboard ───────────────────────────── */
    const { data: usersData } = await supabase
      .from('users')
      .select('id, display_name, total_points')
      .order('total_points', { ascending: false })
      .order('display_name',  { ascending: true  })

    const users = usersData ?? []

    /* ── 4. Most recent snapshot ──────────────────────────── */
    const { data: snapRows } = await supabase
      .from('leaderboard_snapshots')
      .select('user_id, points, rank, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(200)  // enough to cover all users × a few snapshots

    const lastDate = snapRows?.[0]?.snapshot_date ?? null
    const snap = {}
    for (const s of snapRows ?? []) {
      if (s.snapshot_date === lastDate) snap[s.user_id] = s
    }
    const hasSnapshot = lastDate !== null

    /* ── 5. Compute stats ─────────────────────────────────── */

    // Points earned per user in this round
    const roundPts = {}
    for (const b of betsData) {
      roundPts[b.user_id] = (roundPts[b.user_id] ?? 0) + (b.points_earned ?? 0)
    }

    // Rank users + attach snapshot comparison
    const ranked = users.map((u, i) => {
      const rank       = i + 1
      const prev       = snap[u.id]
      const rankChange = prev ? prev.rank - rank : null  // positive = moved up
      return { ...u, rank, rankChange, roundPts: roundPts[u.id] ?? 0 }
    })

    // Star of the round
    const maxRoundPts = Math.max(0, ...Object.values(roundPts))
    const stars = maxRoundPts > 0
      ? ranked.filter(u => u.roundPts === maxRoundPts).map(u => u.display_name)
      : []

    // Exact scores (3-pointers)
    const exactBets = betsData.filter(b => (b.points_earned ?? 0) >= 3)

    // Upsets: winning prediction chosen by <30% of bettors on that match
    const upsets = []
    for (const m of matches) {
      const mb = betsData.filter(b => b.match_id === m.id)
      if (mb.length < 2) continue
      const correctResult = m.home_score > m.away_score ? 'home'
        : m.away_score > m.home_score ? 'away' : 'draw'
      const correctCount  = mb.filter(b => b.prediction === correctResult).length
      const pct = correctCount / mb.length
      if (pct > 0 && pct < 0.3) {
        upsets.push({
          match:   m,
          pct:     Math.round(pct * 100),
          winners: mb.filter(b => b.prediction === correctResult)
                     .map(b => b.users?.display_name).filter(Boolean),
        })
      }
    }

    /* ── 6. Build message ─────────────────────────────────── */
    const msg = buildMessage({ matches, betsData, ranked, stars, maxRoundPts, exactBets, upsets, hasSnapshot, roundStart })
    setText(msg)
    setMeta({ matchCount: matches.length, exactCount: exactBets.length, upsetCount: upsets.length, hasSnapshot, stars })
    setLoading(false)
  }, [])

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function share() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="space-y-4">

      {/* Generate button + meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={generate}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 py-2
                     rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? '⏳ מחשב...' : '📝 צור סיכום'}
        </button>
        {meta && (
          <span className="text-xs text-slate-500">
            {meta.matchCount} משחקים · {meta.exactCount} מדויקים · {meta.upsetCount} הפתעות
            {!meta.hasSnapshot && ' · ⚠️ אין snapshot'}
          </span>
        )}
      </div>

      {/* Preview */}
      {text && (
        <>
          <textarea
            readOnly
            value={text}
            dir="rtl"
            rows={Math.min(30, text.split('\n').length + 1)}
            className="w-full text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl p-3
                       text-slate-700 resize-none focus:outline-none leading-relaxed"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white
                         text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {copied ? '✅ הועתק!' : '📋 העתק'}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white
                         text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              📲 שתף לוואטסאפ
            </button>
          </div>
        </>
      )}

      {/* No-snapshot warning */}
      {meta && !meta.hasSnapshot && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <strong>⚠️ אין Snapshot קודם</strong> — חיצי הדירוג לא יוצגו. הפעל את ה-pg_cron כדי שהמחרת יהיה snapshot.
        </div>
      )}
    </div>
  )
}
