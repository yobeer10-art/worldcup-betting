/**
 * BracketExportCanvas — fixed-size off-screen div captured by html2canvas.
 * Inline styles only (Tailwind is not processed at capture time).
 *
 * Layout sizing rationale:
 *   Longest Hebrew team name: "בוסניה והרצגובינה" (17 chars)
 *   At Arial 10px: ~6px/char → 102px text + 18px flag + 4px gap + 14px padding + 12px icon = ~150px
 *   COL_W = 170 gives a safe 20px buffer so no name is ever truncated.
 *   MATCH_H = 64 gives 2 rows × 27px + 1px divider + 9px padding = 64px — no clipping.
 */
import { forwardRef } from 'react'
import { getFlagCode } from '../../lib/flags'
import { getEff, FEED_SOURCE } from '../../lib/bracketUtils'

// ── Layout constants ───────────────────────────────────────────────────────
const SLOT_H  = 72    // vertical pixels per slot (16 slots total)
const MATCH_H = 64    // match card height — must fit 2 rows comfortably
const ROW_H   = 27    // height of each team row inside the card
const COL_W   = 170   // wide enough for "בוסניה והרצגובינה" at font-size 10
const COL_GAP = 18    // gap between columns (connector lines live here)
const TOP     = 96    // pixels reserved for header
const PAD     = 16    // left/right page margin

const COLS = {
  r32:  PAD,
  r16:  PAD + (COL_W + COL_GAP),
  qf:   PAD + (COL_W + COL_GAP) * 2,
  sf:   PAD + (COL_W + COL_GAP) * 3,
  fin:  PAD + (COL_W + COL_GAP) * 4,
  chmp: PAD + (COL_W + COL_GAP) * 5,
}
const CANVAS_W = COLS.chmp + COL_W + PAD     // ≈ 1130px
const CANVAS_H = TOP + 16 * SLOT_H + 56      // ≈ 1304px

// y-center of a match at floating slot index (0 = topmost slot)
function yc(slot) { return TOP + slot * SLOT_H + SLOT_H / 2 }

// Match cards in order top-to-bottom within their column
const R32_SLOTS = [73,75,74,77,83,84,81,82, 76,78,79,80,86,88,85,87]
  .map((m, i) => ({ m, slot: i }))

const R16_SLOTS = [
  { m:  90, slot:  0.5 }, { m:  89, slot:  2.5 },
  { m:  93, slot:  4.5 }, { m:  94, slot:  6.5 },
  { m:  91, slot:  8.5 }, { m:  92, slot: 10.5 },
  { m:  95, slot: 12.5 }, { m:  96, slot: 14.5 },
]
const QF_SLOTS = [
  { m:  97, slot:  1.5 }, { m:  98, slot:  5.5 },
  { m:  99, slot:  9.5 }, { m: 100, slot: 13.5 },
]
const SF_SLOTS = [
  { m: 101, slot:  3.5 },
  { m: 102, slot: 11.5 },
]
const FIN_SLOTS = [{ m: 104, slot: 7.5 }]

// Connector definitions: two sibling slots → parent at midpoint
const CONNECTORS = [
  // R32 → R16
  ...[0,2,4,6,8,10,12,14].map(s => ({ s1: s, s2: s+1, xFrom: COLS.r32, xTo: COLS.r16 })),
  // R16 → QF
  { s1:  0.5, s2:  2.5, xFrom: COLS.r16, xTo: COLS.qf },
  { s1:  4.5, s2:  6.5, xFrom: COLS.r16, xTo: COLS.qf },
  { s1:  8.5, s2: 10.5, xFrom: COLS.r16, xTo: COLS.qf },
  { s1: 12.5, s2: 14.5, xFrom: COLS.r16, xTo: COLS.qf },
  // QF → SF
  { s1:  1.5, s2:  5.5, xFrom: COLS.qf, xTo: COLS.sf },
  { s1:  9.5, s2: 13.5, xFrom: COLS.qf, xTo: COLS.sf },
  // SF → Final
  { s1:  3.5, s2: 11.5, xFrom: COLS.sf, xTo: COLS.fin },
  // Final → Champion (straight line)
  { s1:  7.5, s2:  7.5, xFrom: COLS.fin, xTo: COLS.chmp },
]

const ROUND_LABELS = [
  { label: 'שלב 32',     x: COLS.r32  },
  { label: 'שמינית גמר', x: COLS.r16  },
  { label: 'רבע גמר',   x: COLS.qf   },
  { label: 'חצי גמר',   x: COLS.sf   },
  { label: 'גמר',       x: COLS.fin  },
  { label: '🏆 אלוף',   x: COLS.chmp },
]

// Match number → column x (computed once)
const COL_BY_MATCH = {
  ...Object.fromEntries(R32_SLOTS.map(s => [s.m, COLS.r32])),
  ...Object.fromEntries(R16_SLOTS.map(s => [s.m, COLS.r16])),
  ...Object.fromEntries(QF_SLOTS.map(s => [s.m, COLS.qf])),
  ...Object.fromEntries(SF_SLOTS.map(s => [s.m, COLS.sf])),
  ...Object.fromEntries(FIN_SLOTS.map(s => [s.m, COLS.fin])),
}

const LINE_COLOR  = 'rgba(110,231,183,0.5)'
const BG_FROM     = '#0b3d1f'
const BG_TO       = '#071c0e'
const PICK_BG     = '#fef9c3'
const REAL_WIN_BG = '#d1fae5'
const CHMP_BG     = 'linear-gradient(135deg,#78350f,#b45309)'

// ── Flag image (cross-origin so html2canvas can read pixels) ───────────────
function Flag({ team }) {
  const code = getFlagCode(team)
  if (!code) return (
    <span style={{
      width: 20, height: 14, display: 'inline-block', flexShrink: 0,
      background: '#e2e8f0', borderRadius: 2,
    }} />
  )
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      crossOrigin="anonymous"
      alt=""
      style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2,
               flexShrink: 0, display: 'block' }}
    />
  )
}

// ── One match card ───────────────────────────────────────────────────────────
function MatchCard({ mn, col, slot, matchByNum, predByNum }) {
  const match    = matchByNum[mn]
  const homeInfo = getEff(mn, 'home', matchByNum, predByNum)
  const awayInfo = getEff(mn, 'away', matchByNum, predByNum)
  const homeTeam = homeInfo?.team ?? null
  const awayTeam = awayInfo?.team ?? null

  const pick       = predByNum[mn] ?? null
  const isFinished = match?.status === 'finished'
  const realWinner = isFinished
    ? (match?.result === 'home' ? homeTeam : awayTeam)
    : null

  // Top of card — centred within its slot vertically
  const yTop = TOP + slot * SLOT_H + (SLOT_H - MATCH_H) / 2

  function TeamRow({ team }) {
    const isPick   = pick === team && team !== null
    const isWinner = realWinner === team && team !== null
    const highlight = isPick || isWinner
    const rowBg = isWinner ? REAL_WIN_BG : (isPick && !isFinished ? PICK_BG : 'transparent')

    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        height: ROW_H,
        padding: '0 7px',
        gap: 5,
        background: rowBg,
        borderRadius: 3,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}>
        {/* Flag or placeholder */}
        {team
          ? <Flag team={team} />
          : <span style={{ width: 20, height: 14, background: '#e2e8f0',
                           borderRadius: 2, flexShrink: 0, display: 'inline-block' }} />
        }

        {/* Team name — no truncation, no overflow hidden on card so it's always visible */}
        <span style={{
          fontSize: 10,
          fontFamily: 'Arial, sans-serif',
          fontWeight: highlight ? 700 : 400,
          color: team ? '#0f172a' : '#94a3b8',
          flex: 1,
          direction: 'rtl',
          textAlign: 'right',
          lineHeight: 1.2,
          // deliberately no whiteSpace/overflow/textOverflow — names must show in full
        }}>
          {team ?? '—'}
        </span>

        {/* Pick / winner badge */}
        {isPick && !isFinished && (
          <span style={{ fontSize: 9, color: '#0369a1', flexShrink: 0, fontFamily: 'Arial' }}>✓</span>
        )}
        {isWinner && (
          <span style={{ fontSize: 9, flexShrink: 0 }}>🥇</span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      left: col,
      top: yTop,
      width: COL_W,
      height: MATCH_H,
      background: '#ffffff',
      borderRadius: 7,
      border: '1px solid #e2e8f0',
      // NO overflow:hidden — that was clipping the bottom team row
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      boxSizing: 'border-box',
      padding: '3px 0',
      gap: 0,
    }}>
      <TeamRow team={homeTeam} />
      {/* Divider */}
      <div style={{ height: 1, background: '#f1f5f9', margin: '0 7px', flexShrink: 0 }} />
      <TeamRow team={awayTeam} />
    </div>
  )
}

// ── Champion box ─────────────────────────────────────────────────────────────
function ChampionBox({ matchByNum, predByNum }) {
  const champTeam  = predByNum[104] ?? null
  const finalMatch = matchByNum[104]
  const isFinished = finalMatch?.status === 'finished'
  const actualChamp = isFinished
    ? (finalMatch?.result === 'home' ? finalMatch.home_team : finalMatch.away_team)
    : null
  const showTeam = actualChamp ?? champTeam

  const boxH = MATCH_H * 1.6
  const yTop = TOP + 7.5 * SLOT_H + (SLOT_H - boxH) / 2

  return (
    <div style={{
      position: 'absolute', left: COLS.chmp, top: yTop,
      width: COL_W, minHeight: boxH,
      background: CHMP_BG,
      borderRadius: 10,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 5, padding: '10px 8px',
      boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>🏆</span>
      {showTeam ? (
        <>
          <Flag team={showTeam} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#fef3c7',
            fontFamily: 'Arial, sans-serif', direction: 'rtl',
            textAlign: 'center', lineHeight: 1.3,
          }}>
            {showTeam}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: 10, color: 'rgba(254,243,199,0.5)',
          fontFamily: 'Arial, sans-serif', direction: 'rtl',
        }}>
          טרם נבחר
        </span>
      )}
    </div>
  )
}

// ── Connector lines between rounds ───────────────────────────────────────────
function ConnectorLines() {
  return CONNECTORS.map(({ s1, s2, xFrom, xTo }, i) => {
    const y1   = yc(s1)
    const y2   = yc(s2)
    const yMid = (y1 + y2) / 2
    const xR   = xFrom + COL_W               // right edge of source col
    const xM   = xFrom + COL_W + COL_GAP / 2 // midpoint of gap
    const xL   = xTo                          // left edge of target col

    if (s1 === s2) {
      // straight horizontal line (Final → Champion)
      return (
        <div key={i} style={{
          position: 'absolute', left: xR, top: y1 - 1,
          width: xL - xR, height: 2, background: LINE_COLOR,
        }} />
      )
    }

    return (
      <div key={i}>
        {/* Top arm */}
        <div style={{ position: 'absolute', left: xR, top: y1 - 1, width: xM - xR, height: 2, background: LINE_COLOR }} />
        {/* Bottom arm */}
        <div style={{ position: 'absolute', left: xR, top: y2 - 1, width: xM - xR, height: 2, background: LINE_COLOR }} />
        {/* Vertical joiner */}
        <div style={{ position: 'absolute', left: xM - 1, top: y1, width: 2, height: y2 - y1, background: LINE_COLOR }} />
        {/* Line to parent */}
        <div style={{ position: 'absolute', left: xM, top: yMid - 1, width: xL - xM, height: 2, background: LINE_COLOR }} />
      </div>
    )
  })
}

// ── Main export canvas ───────────────────────────────────────────────────────
const BracketExportCanvas = forwardRef(function BracketExportCanvas(
  { bracketMatches, matchByNum, predByNum, userName },
  ref,
) {
  const allSlots = [...R32_SLOTS, ...R16_SLOTS, ...QF_SLOTS, ...SF_SLOTS, ...FIN_SLOTS]
  const pickedCount = Object.keys(predByNum).length
  const today = new Date().toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: -9999,
        left: 0,
        zIndex: -1,
        width:  CANVAS_W,
        height: CANVAS_H,
        background: `linear-gradient(180deg, ${BG_FROM} 0%, ${BG_TO} 100%)`,
        fontFamily: 'Arial, sans-serif',
        direction: 'rtl',
        // NO overflow:hidden on the root — allow cards to paint fully
      }}
    >
      {/* ── Header ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: TOP,
        background: 'linear-gradient(90deg,#14532d,#166534,#14532d)',
        borderBottom: '2px solid rgba(110,231,183,0.3)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 14, boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>⚽</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fef3c7', direction: 'rtl', textAlign: 'right' }}>
            הברקט של {userName || 'שחקן'} · מונדיאל 2026
          </div>
          <div style={{ fontSize: 11, color: 'rgba(167,243,208,0.8)', direction: 'rtl', textAlign: 'right', marginTop: 3 }}>
            {pickedCount} ניחושים · {today}
          </div>
        </div>
        <div style={{
          fontSize: 10, color: '#a7f3d0',
          border: '1px solid rgba(110,231,183,0.4)',
          borderRadius: 12, padding: '4px 10px', flexShrink: 0,
        }}>
          FIFA WC 2026
        </div>
      </div>

      {/* ── Round column labels ── */}
      {ROUND_LABELS.map(({ label, x }) => (
        <div key={label} style={{
          position: 'absolute', top: TOP - 24, left: x,
          width: COL_W, textAlign: 'center',
          fontSize: 10, fontWeight: 700, color: 'rgba(167,243,208,0.9)',
          fontFamily: 'Arial, sans-serif',
        }}>
          {label}
        </div>
      ))}

      {/* ── Mid-bracket divider ── */}
      <div style={{
        position: 'absolute', left: PAD, right: PAD,
        top: TOP + 8 * SLOT_H - 1, height: 1,
        background: 'rgba(110,231,183,0.12)',
      }} />

      {/* ── Connectors (rendered behind cards) ── */}
      <ConnectorLines />

      {/* ── Match cards ── */}
      {allSlots.map(({ m, slot }) => (
        <MatchCard
          key={m}
          mn={m}
          col={COL_BY_MATCH[m]}
          slot={slot}
          matchByNum={matchByNum}
          predByNum={predByNum}
        />
      ))}

      {/* ── Champion box ── */}
      <ChampionBox matchByNum={matchByNum} predByNum={predByNum} />

      {/* ── Watermark ── */}
      <div style={{
        position: 'absolute', bottom: 8, right: 16,
        fontSize: 9, color: 'rgba(110,231,183,0.3)',
        fontFamily: 'Arial, sans-serif',
      }}>
        מונדיאל 2026
      </div>
    </div>
  )
})

export default BracketExportCanvas
