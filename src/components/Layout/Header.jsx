import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAdmin } from '../../context/AdminContext'

const NAV = [
  { to: '/',           label: 'בית',     icon: '🏠' },
  { to: '/matches',    label: 'משחקים',  icon: '⚽' },
  { to: '/groups',     label: 'בתים',    icon: '🏟️' },
  { to: '/leaderboard',label: 'דירוג',   icon: '🏆' },
]

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const { isAdmin }                = useAdmin()
  const { pathname }               = useLocation()

  return (
    <header className="sticky top-0 z-50">
      {/* Rainbow-ish accent line */}
      <div className="h-[3px] bg-gradient-to-r from-emerald-400 via-green-300 to-teal-400" />

      {/* Main bar */}
      <div
        className="bg-gradient-to-r from-green-900 via-green-800 to-emerald-700 shadow-2xl"
        style={{ backgroundSize: '200% 100%' }}
      >
        <div className="max-w-lg mx-auto px-4">
          {/* Top row */}
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group select-none">
              <span className="text-2xl transition-transform duration-300 group-hover:rotate-[20deg]">
                ⚽
              </span>
              <div>
                <div className="font-extrabold text-white text-[15px] leading-none tracking-tight">
                  מונדיאל 2026
                </div>
                <div className="text-emerald-300 text-[10px] leading-none mt-[3px] tracking-wide">
                  USA · Canada · Mexico
                </div>
              </div>
            </Link>

            {/* User area */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {/* Admin badge */}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`hidden sm:flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors border ${
                        pathname === '/admin'
                          ? 'bg-amber-400 text-amber-900 border-amber-300'
                          : 'bg-white/10 hover:bg-white/20 text-amber-300 border-white/10'
                      }`}
                    >
                      🔐 ניהול
                    </Link>
                  )}
                  {profile?.total_points != null && (
                    <div className="hidden sm:flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-lg">
                      <span className="text-sm">⭐</span>
                      <span className="text-white font-extrabold text-sm tabular-nums">
                        {profile.total_points}
                      </span>
                    </div>
                  )}
                  <span className="hidden sm:block text-emerald-200 text-xs max-w-[96px] truncate">
                    {profile?.display_name || user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-xs bg-white/10 hover:bg-white/20 active:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/10"
                  >
                    יציאה
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="text-sm bg-white text-green-900 hover:bg-green-50 active:bg-green-100 px-4 py-1.5 rounded-lg font-bold shadow-lg transition-colors"
                >
                  כניסה
                </Link>
              )}
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex">
            {NAV.map(({ to, label, icon }) => {
              const active = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 ${
                    active
                      ? 'text-white border-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                      : 'text-green-300/60 border-transparent hover:text-white hover:border-green-500/40'
                  }`}
                >
                  <span className={active ? '' : 'opacity-70'}>{icon}</span>
                  <span>{label}</span>
                </Link>
              )
            })}
            {/* Admin tab (mobile — only visible for admins) */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`sm:hidden flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 ${
                  pathname === '/admin'
                    ? 'text-amber-300 border-amber-400'
                    : 'text-green-300/60 border-transparent hover:text-amber-300'
                }`}
              >
                <span>🔐</span>
                <span>ניהול</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
