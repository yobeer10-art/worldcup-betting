import { useState } from 'react'

const PRICE_STEPS = [0, 30000, 50000, 70000, 100000, 150000, 200000, 300000]
const KM_STEPS    = [50000, 100000, 150000, 200000, 250000]
const HAND_STEPS  = [1, 2, 3, 4]

export const EMPTY_FILTERS = {
  q: '', make: '', minPrice: '', maxPrice: '', maxKm: '', maxHand: '',
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-slate-400">{label}</span>
      {children}
    </label>
  )
}

const selectClass =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold ' +
  'text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors'

export default function CarFilters({ filters, setFilters, makes, resultCount }) {
  const [open, setOpen] = useState(false)

  const activeCount = Object.entries(filters)
    .filter(([k, v]) => k !== 'q' && v !== '').length

  const set = (key, value) => setFilters(f => ({ ...f, [key]: value }))

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* חיפוש + כפתור סינון */}
      <div className="p-3 flex gap-2">
        <div className="relative flex-1">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">🔍</span>
          <input
            type="search"
            value={filters.q}
            onChange={e => set('q', e.target.value)}
            placeholder="חיפוש יצרן או דגם..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2.5
                       text-sm font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-medium
                       focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 ${
            activeCount > 0
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          סינון
          {activeCount > 0 && (
            <span className="bg-white/25 text-[11px] px-1.5 rounded-full">{activeCount}</span>
          )}
        </button>
      </div>

      {/* פאנל סינון */}
      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Field label="יצרן">
            <select value={filters.make} onChange={e => set('make', e.target.value)} className={selectClass}>
              <option value="">הכל</option>
              {makes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>

          <Field label="יד מקסימלית">
            <select value={filters.maxHand} onChange={e => set('maxHand', e.target.value)} className={selectClass}>
              <option value="">הכל</option>
              {HAND_STEPS.map(h => <option key={h} value={h}>עד יד {h}</option>)}
            </select>
          </Field>

          <Field label="מחיר מינימלי">
            <select value={filters.minPrice} onChange={e => set('minPrice', e.target.value)} className={selectClass}>
              <option value="">ללא</option>
              {PRICE_STEPS.slice(1).map(p => (
                <option key={p} value={p}>₪{p.toLocaleString('he-IL')}</option>
              ))}
            </select>
          </Field>

          <Field label="מחיר מקסימלי">
            <select value={filters.maxPrice} onChange={e => set('maxPrice', e.target.value)} className={selectClass}>
              <option value="">ללא</option>
              {PRICE_STEPS.slice(1).map(p => (
                <option key={p} value={p}>₪{p.toLocaleString('he-IL')}</option>
              ))}
            </select>
          </Field>

          <Field label="קילומטראז׳ מקסימלי">
            <select value={filters.maxKm} onChange={e => set('maxKm', e.target.value)} className={selectClass}>
              <option value="">הכל</option>
              {KM_STEPS.map(k => (
                <option key={k} value={k}>עד {k.toLocaleString('he-IL')} ק״מ</option>
              ))}
            </select>
          </Field>

          <div className="flex items-end">
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              disabled={activeCount === 0 && !filters.q}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-50
                         hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              נקה הכל
            </button>
          </div>
        </div>
      )}

      {/* מונה תוצאות */}
      <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100">
        <p className="text-[12px] font-bold text-slate-400">
          {resultCount === 0 ? 'לא נמצאו רכבים' : `${resultCount} רכבים בקטלוג`}
        </p>
      </div>
    </div>
  )
}
