import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getFlag } from '../../lib/flags'

/**
 * Click-based ordered selection:
 *   • tap unselected → fills 1st empty slot (1st → 2nd)
 *   • tap 1st selected → deselect; promote 2nd → 1st
 *   • tap 2nd selected → deselect 2nd
 *   • tap unselected when both full → replaces 2nd
 */
export default function GroupPredictionModal({
  group,
  standings,
  existingPrediction,
  onSave,
  onClose,
}) {
  const [first, setFirst]   = useState(existingPrediction?.first_place  ?? null)
  const [second, setSecond] = useState(existingPrediction?.second_place ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function pick(name) {
    if (name === first) {
      setFirst(second); setSecond(null)
    } else if (name === second) {
      setSecond(null)
    } else if (!first) {
      setFirst(name)
    } else if (!second) {
      setSecond(name)
    } else {
      setSecond(name) // replace 2nd
    }
  }

  function slotOf(name) {
    if (name === first)  return 1
    if (name === second) return 2
    return 0
  }

  async function handleSave() {
    if (!first || !second || saving) return
    setSaving(true)
    await onSave(first, second)
    setSaving(false)
  }

  const canSave = first && second

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="relative bg-gradient-to-r from-green-800 to-emerald-600 px-5 py-4 overflow-hidden">
          <div className="absolute -end-3 -bottom-4 text-8xl font-black text-white/[0.07] select-none pointer-events-none leading-none">
            {group.name}
          </div>
          <div className="relative flex items-start justify-between">
            <div>
              <h2 className="text-white font-extrabold text-lg leading-tight">
                🔮 נחש מי עולה
              </h2>
              <p className="text-emerald-200 text-xs mt-0.5">
                בית {group.name} — בחר 2 קבוצות לשלב הנוקאאוט
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white text-2xl leading-none mt-0.5 transition-colors select-none"
              aria-label="סגור"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Slot indicators ── */}
        <div className="flex gap-3 px-5 pt-4">
          <SlotBox
            rank={1}
            name={first}
            label="מקום ראשון"
            borderCls="border-yellow-400 bg-yellow-50"
            emptyText="לחץ לבחירה"
          />
          <SlotBox
            rank={2}
            name={second}
            label="מקום שני"
            borderCls="border-slate-400 bg-slate-50"
            emptyText="לחץ לבחירה"
          />
        </div>

        {/* ── Team buttons ── */}
        <div className="px-5 pt-3 pb-2 space-y-2">
          {standings.map((team) => {
            const slot = slotOf(team.name)
            return (
              <button
                key={team.name}
                onClick={() => pick(team.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                  slot === 1
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-900 shadow-sm shadow-yellow-100'
                    : slot === 2
                    ? 'border-slate-400 bg-slate-100 text-slate-800 shadow-sm'
                    : 'border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-200'
                }`}
              >
                <span className="text-2xl leading-none">{getFlag(team.name)}</span>
                <span className="flex-1 text-start">{team.name}</span>

                {/* current stats summary when there are played matches */}
                {team.mp > 0 && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {team.pts} נק'
                  </span>
                )}

                {/* selection badge */}
                {slot === 1 && (
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-400 text-white flex items-center justify-center font-extrabold text-sm shadow">
                    1
                  </span>
                )}
                {slot === 2 && (
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-500 text-white flex items-center justify-center font-extrabold text-sm shadow">
                    2
                  </span>
                )}
                {slot === 0 && (
                  <span className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-slate-300" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Scoring hint ── */}
        <p className="text-center text-[11px] text-slate-400 px-5 pt-1">
          2 נקודות על ניצחון הבית · 1 נקודה על המקום השני
        </p>

        {/* ── Actions ── */}
        <div className="flex gap-3 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 active:scale-[0.97] transition-all"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-3 rounded-2xl bg-green-600 text-white font-extrabold text-sm hover:bg-green-700 active:scale-[0.97] transition-all shadow-lg shadow-green-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {saving ? 'שומר...' : canSave ? 'שמור ניחוש ✓' : 'בחר 2 קבוצות'}
          </button>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

/* ── Slot indicator box ──────────────────────────────────────────── */
function SlotBox({ rank, name, borderCls, emptyText }) {
  const medal = rank === 1 ? '🥇' : '🥈'
  return (
    <div
      className={`flex-1 h-11 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 ${
        name ? borderCls : 'border-dashed border-slate-200 text-slate-400'
      }`}
    >
      {name ? (
        <>
          <span className="text-base leading-none">{getFlag(name)}</span>
          <span className="truncate max-w-[80px]">{name}</span>
          <span>{medal}</span>
        </>
      ) : (
        <span className="text-slate-400">{emptyText}</span>
      )}
    </div>
  )
}
