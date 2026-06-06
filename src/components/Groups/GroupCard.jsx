import { useState } from 'react'
import { getFlag } from '../../lib/flags'
import { computeStandings, isPredictionLocked, STAT_COLS } from '../../lib/groups'
import GroupPredictionModal from './GroupPredictionModal'

/* ── Row visual style per rank ──────────────────────────────────── */
const ROW_BG = [
  'bg-emerald-50/80',   // 1st — qualifies
  'bg-emerald-50/50',   // 2nd — qualifies
  'bg-amber-50/70',     // 3rd — playoff / possible
  'bg-rose-50/50',      // 4th — eliminated
]
const DOT_CLS = [
  'bg-emerald-500',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
]

/* ── Stat cell ──────────────────────────────────────────────────── */
function StatCell({ col, value }) {
  const isGD  = col.key === 'gd'
  const isPts = col.key === 'pts'

  let display = value
  if (isGD && value > 0) display = `+${value}`

  return (
    <div
      className={`w-6 text-center flex-shrink-0 tabular-nums leading-none
        ${col.mobileHidden ? 'hidden sm:block' : ''}
        ${isPts ? 'font-extrabold text-slate-800 text-[13px]' : 'text-[11px] text-slate-400'}
        ${isGD && value > 0 ? 'text-emerald-600' : ''}
        ${isGD && value < 0 ? 'text-rose-500' : ''}
        ${isPts && value > 0 ? 'text-emerald-700' : ''}
      `}
    >
      {display}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────── */
// readOnly=true → suppress all prediction UI (used by TablesPage)
export default function GroupCard({ group, allMatches, prediction, onPredictionSaved, user, readOnly = false }) {
  const [showModal, setShowModal] = useState(false)
  const standings = computeStandings(group.name, group.teams, allMatches)
  const locked    = isPredictionLocked()
  const hasPred   = !!prediction
  const canPredict = user && !locked && !readOnly

  return (
    <>
      <div className="match-card bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col">

        {/* ── Group header ──────────────────────────────────────── */}
        <div className="relative bg-gradient-to-r from-green-800 to-emerald-700 px-4 py-3 flex items-center justify-between overflow-hidden flex-shrink-0">
          {/* Watermark group letter */}
          <span className="absolute -end-1 -top-2 text-[72px] font-black text-white/[0.06] select-none pointer-events-none leading-none">
            {group.name}
          </span>

          <div className="relative flex items-center gap-2">
            {hasPred && (
              <span className="text-emerald-300 text-sm leading-none" title="ניחשת">✅</span>
            )}
            <span className="font-extrabold text-white text-[15px]">בית {group.name}</span>
            <span className="text-emerald-300/80 text-[11px] border border-emerald-500/30 px-1.5 py-px rounded-md">
              4 קבוצות
            </span>
          </div>

          <div className="relative">
            {canPredict ? (
              <button
                onClick={() => setShowModal(true)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  hasPred
                    ? 'bg-white/20 hover:bg-white/30 text-white border-white/20'
                    : 'bg-white text-green-800 hover:bg-green-50 border-transparent shadow'
                }`}
              >
                {hasPred ? '✏️ ערוך' : '🔮 נחש'}
              </button>
            ) : user && locked && !readOnly ? (
              <span className="text-[11px] text-emerald-300/60 flex items-center gap-1">🔒 נעול</span>
            ) : null}
          </div>
        </div>

        {/* ── Stats table header ────────────────────────────────── */}
        <div className="flex items-center px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          {/* gutter: dot + rank */}
          <div className="w-[26px]" />
          {/* team name */}
          <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            קבוצה
          </div>
          {/* stat headers */}
          {STAT_COLS.map((col) => (
            <div
              key={col.key}
              className={`w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider
                ${col.mobileHidden ? 'hidden sm:block' : ''}`}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* ── Standings rows ────────────────────────────────────── */}
        <div className="divide-y divide-slate-100/80 flex-1">
          {standings.map((team, idx) => (
            <div
              key={team.name}
              className={`flex items-center px-3 py-2.5 gap-1 transition-colors ${ROW_BG[idx] ?? 'bg-white'}`}
            >
              {/* Status dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 mr-1.5 ${DOT_CLS[idx]}`}
                title={['עולה', 'עולה', 'אפשרי', 'נפסל'][idx]}
              />

              {/* Crown or rank number */}
              <div className="w-4 text-center flex-shrink-0">
                {idx === 0
                  ? <span className="text-[13px] leading-none">👑</span>
                  : <span className="text-[10px] text-slate-400 font-bold">{idx + 1}</span>
                }
              </div>

              {/* Flag + team name */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <span className="text-[18px] leading-none flex-shrink-0">{getFlag(team.name)}</span>
                <span className="text-[12px] font-semibold text-slate-800 truncate leading-snug">
                  {team.name}
                </span>
              </div>

              {/* Stat cells */}
              {STAT_COLS.map((col) => (
                <StatCell key={col.key} col={col} value={team[col.key]} />
              ))}
            </div>
          ))}
        </div>

        {/* ── User prediction footer ────────────────────────────── */}
        {!readOnly && prediction ? (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex-shrink-0">
            <span className="text-[11px] text-emerald-600 font-bold whitespace-nowrap">
              הניחוש שלך:
            </span>
            <span className="flex items-center gap-2 text-[11px] min-w-0 flex-wrap">
              <span className="flex items-center gap-1 font-bold text-yellow-700">
                🥇 {getFlag(prediction.first_place)}
                <span className="truncate">{prediction.first_place}</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1 font-semibold text-slate-600">
                🥈 {getFlag(prediction.second_place)}
                <span className="truncate">{prediction.second_place}</span>
              </span>
            </span>
            {prediction.is_graded && (
              <span className="mr-auto text-[11px] font-bold text-emerald-600 whitespace-nowrap">
                +{prediction.points_earned} נק׳
              </span>
            )}
          </div>
        ) : !readOnly && canPredict ? (
          <div className="px-4 py-2.5 border-t border-dashed border-slate-200 bg-slate-50/60">
            <button
              onClick={() => setShowModal(true)}
              className="w-full text-center text-[12px] text-slate-400 hover:text-green-600 font-medium transition-colors"
            >
              + לחץ לנחש מי יעלה מהבית
            </button>
          </div>
        ) : null}

      </div>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <GroupPredictionModal
          group={group}
          standings={standings}
          existingPrediction={prediction}
          onSave={async (first, second) => {
            await onPredictionSaved(group.name, first, second)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
