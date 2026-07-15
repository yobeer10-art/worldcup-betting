import { useEffect, useState } from 'react'
import FlagImg from './FlagImg'

// Full-screen animated intro ("popup video") for the grand final.
// Plays a staged CSS animation sequence once per session; tap anywhere to skip.
export default function FinalHypeSplash({ match, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!match) return
    if (sessionStorage.getItem('finalSplashSeen') === '1') return
    setVisible(true)
    sessionStorage.setItem('finalSplashSeen', '1')
  }, [match])

  if (!visible || !match) return null

  function close() {
    setVisible(false)
    onClose?.()
  }

  const kickoff = match.match_date
    ? new Date(match.match_date).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem', weekday: 'long', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div
      className="splash-stage fixed inset-0 z-[100] flex flex-col items-center justify-center
                 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 px-6 overflow-hidden"
      onClick={close}
    >
      {/* Ambient glows */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-fuchsia-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Skip */}
      <button
        onClick={close}
        className="absolute top-5 left-5 text-white/40 hover:text-white text-sm font-bold px-3 py-1.5
                   rounded-full border border-white/15"
      >
        דלג ✕
      </button>

      {/* Title */}
      <p className="text-white/50 text-xs font-bold tracking-[0.5em] uppercase mb-3">מונדיאל 2026</p>
      <h1 className="splash-title splash-gold-text text-5xl font-black text-center leading-tight mb-10">
        הגמר הגדול
      </h1>

      {/* Teams */}
      <div className="flex items-center justify-center gap-6 mb-10 w-full max-w-sm">
        <div className="splash-home flex flex-col items-center gap-2 flex-1">
          <FlagImg team={match.home_team} size="lg" className="rounded-lg shadow-2xl shadow-amber-500/20" />
          <span className="text-white text-lg font-black">{match.home_team}</span>
        </div>
        <span className="splash-vs text-4xl font-black text-transparent bg-clip-text
                         bg-gradient-to-b from-amber-300 to-orange-500 shrink-0">
          VS
        </span>
        <div className="splash-away flex flex-col items-center gap-2 flex-1">
          <FlagImg team={match.away_team} size="lg" className="rounded-lg shadow-2xl shadow-sky-500/20" />
          <span className="text-white text-lg font-black">{match.away_team}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="splash-meta text-center mb-8">
        {kickoff && (
          <p className="text-white/80 text-sm font-bold mb-2">🕐 {kickoff} · כאן 11</p>
        )}
        <p className="text-white/50 text-xs font-semibold">
          עולה = 3 נק׳ · תוצאה מדויקת 90 ד׳ = 5 נק׳ · אלופה = 25 נק׳
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={close}
        className="splash-cta bg-gradient-to-l from-amber-400 to-yellow-500 text-amber-950
                   text-base font-black px-10 py-3.5 rounded-2xl shadow-xl shadow-amber-500/30
                   active:scale-95 transition-transform"
      >
        🎯 אני מהמר!
      </button>
    </div>
  )
}
