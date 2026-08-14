/* סליידר טווח דו־ידיתי (מינימום/מקסימום).
   המסילה עצמה LTR כדי להימנע מבאגי RTL — התוויות בעברית מעליה. */
export default function RangeSlider({
  min, max, step = 1000,
  value,                       // [minVal, maxVal]
  onChange,
  format = n => n,
}) {
  const [lo, hi] = value
  const pct = n => ((n - min) / (max - min)) * 100

  const setLo = v => onChange([Math.min(+v, hi - step), hi])
  const setHi = v => onChange([lo, Math.max(+v, lo + step)])

  return (
    <div>
      {/* תוויות */}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[12px] font-extrabold text-blue-700 tabular-nums">{format(lo)}</span>
        <span className="text-[10px] text-slate-300 font-bold">עד</span>
        <span className="text-[12px] font-extrabold text-blue-700 tabular-nums">
          {hi >= max ? `${format(max)}+` : format(hi)}
        </span>
      </div>

      {/* מסילה */}
      <div className="relative h-5 select-none" dir="ltr">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-200 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-blue-600 rounded-full"
          style={{ left: `${pct(lo)}%`, width: `${Math.max(pct(hi) - pct(lo), 0)}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={lo}
          onChange={e => setLo(e.target.value)}
          className="range-thumb absolute inset-0 w-full"
          style={{ zIndex: lo > max - (max - min) * 0.1 ? 5 : 3 }}
          aria-label="מחיר מינימלי"
        />
        <input
          type="range" min={min} max={max} step={step} value={hi}
          onChange={e => setHi(e.target.value)}
          className="range-thumb absolute inset-0 w-full"
          style={{ zIndex: 4 }}
          aria-label="מחיר מקסימלי"
        />
      </div>
    </div>
  )
}
