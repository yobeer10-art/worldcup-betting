import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Minimal top bar — logo + user points.
 * Navigation is handled by BottomNav (mobile-first).
 */
export default function Header() {
  const { user, profile, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100
                       shadow-sm backdrop-blur-sm bg-white/95">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 select-none group">
          <span className="text-lg transition-transform duration-300 group-hover:rotate-[20deg]">⚽</span>
          <span className="font-extrabold text-slate-800 text-sm tracking-tight">מונדיאל 2026</span>
        </Link>

        {/* User area */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {profile?.total_points != null && (
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200
                               text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                  ⭐ {profile.total_points}
                </div>
              )}
              {profile?.display_name && (
                <span className="hidden sm:block text-slate-500 text-xs font-medium max-w-[80px] truncate">
                  {profile.display_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium
                           transition-colors px-1.5 py-1"
              >
                יציאה
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="text-sm bg-emerald-500 hover:bg-emerald-600 text-white
                         px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm"
            >
              כניסה
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
