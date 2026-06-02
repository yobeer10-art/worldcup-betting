import { getFlagCode } from '../../lib/flags'

/**
 * Renders a country flag as an <img> from flagcdn.com.
 * Works on ALL browsers including Windows Chrome (which cannot render flag emojis).
 *
 * sizes:
 *   xs  — 20 × 15 px  (tiny inline)
 *   sm  — 28 × 21 px  (admin lists)
 *   md  — 40 × 30 px  (bracket cards)
 *   lg  — 64 × 48 px  (match cards, main display)
 */
const SIZES = {
  xs: { cdn: 20, w: 20, h: 15 },
  sm: { cdn: 40, w: 28, h: 21 },
  md: { cdn: 40, w: 40, h: 30 },
  lg: { cdn: 80, w: 64, h: 48 },
}

export default function FlagImg({ team, size = 'md', className = '' }) {
  const code = getFlagCode(team)
  const s    = SIZES[size] ?? SIZES.md

  if (!code) {
    // Fallback placeholder — same dimensions so layout doesn't shift
    return (
      <span
        style={{ width: s.w, height: s.h, display: 'inline-flex', flexShrink: 0 }}
        className={`items-center justify-center rounded-sm bg-slate-100 text-slate-300 text-[10px] font-bold ${className}`}
      >
        ?
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w${s.cdn}/${code}.png`}
      srcSet={`https://flagcdn.com/w${s.cdn * 2}/${code}.png 2x`}
      alt={team ?? ''}
      width={s.w}
      height={s.h}
      loading="lazy"
      decoding="async"
      className={`inline-block rounded-sm object-cover flex-shrink-0 ${className}`}
      style={{ width: s.w, height: s.h }}
    />
  )
}
