import { Link } from 'react-router-dom'
import { SITE, WHATSAPP_NUMBER } from '../../config'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700
                           flex items-center justify-center text-white text-xl shrink-0 shadow-sm">
            🚐
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold text-slate-900 leading-tight truncate">
              {SITE.name}
            </span>
            <span className="block text-[11px] text-slate-400 leading-tight truncate">
              {SITE.tagline}
            </span>
          </span>
        </Link>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white
                     text-sm font-bold px-3.5 py-2 rounded-xl transition-colors active:scale-95"
        >
          <span>💬</span>
          <span className="hidden sm:inline">דברו איתנו</span>
        </a>
      </div>
    </header>
  )
}
