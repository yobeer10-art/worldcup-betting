import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAdmin } from '../../context/AdminContext'

const NAV = [
  { to: '/matches',       label: 'משחקים',         icon: '⚽' },
  { to: '/pretournament', label: 'הימורים מקדימים', icon: '🔮' },
  { to: '/bracket',       label: 'ברקט',            icon: '🎯' },
  { to: '/tables',        label: 'טבלאות',          icon: '📊' },
  { to: '/leaderboard',   label: 'דירוג',           icon: '🏆' },
]

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const { isAdmin }                = useAdmin()
  const { pathname }               = useLocation()

  return (
    <header className="sticky top-0 z-50">
      {/* Top accent line */}
      <div className="h-[3px] bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400" />

      {/* Main bar */}
      <div className="bg-gradient-to-r from-green-900 via-green-800 to-emerald-700 shadow-2xl">
        <div className="max-w-lg mx-auto px-4">

          {/* Top row */}
          <div className="flex items-center justify-between h-12">
            <Link to="/matches" className="flex items-center gap-2 group select-none shrink-0">
              <span className="text-xl transition-transform duration-300 group-hover:rotate-[20deg]">⚽</span>
              <div>
                <div className="font-extrabold text-white text-[14px] leading-none tracking-tight">
                  מונדיאל 2026
                </div>
                <div className="text-emerald-300 text-[9px] leading-none mt-[2px] tracking-wide">
                  USA · Canada · Mexico
                </div>
              </div>
            </Link>

            {/* User area */}
            <div className="flex items-center gap-1.5">
              {user ? (
                <>
                  {profile?.total_points != null && (
                    <div className="flex items-center gap-1 bg-white/10 border border-white/10 px-2 py-1 rounded-lg">
                      <span className="text-xs">⭐</span>
                      <span className="text-white font-extrabold text-xs tabular-nums">
                        {profile.total_points}
                      </span>
                    </div>
                  )}
                  <span className="hidden sm:block text-emerald-200 text-xs max-w-[80px] truncate">
                    {profile?.display_name || user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-xs bg-white/10 hover:bg-white/20 active:bg-white/30 text-white px-2 py-1.5 rounded-lg transition-colors border border-white/10"
                  >
                    יציאה
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="text-sm bg-white text-green-900 hover:bg-green-50 px-3 py-1.5 rounded-lg font-bold shadow-lg transition-colors"
                >
                  כניסה
                </Link>
              )}
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex">
            {NAV.map(({ to, label, icon }) => {
              const active = pathname === to || (to === '/pretournament' && ['/pretournament','/groups','/champion'].includes(pathname))
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 text-[9.5px] sm:text-xs font-semibold border-b-2 transition-all duration-200 ${
                    active
                      ? 'text-white border-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                      : 'text-green-300/60 border-transparent hover:text-white hover:border-green-500/40'
                  }`}
                >
                  <span className={`text-sm sm:text-xs ${active ? '' : 'opacity-70'}`}>{icon}</span>
                  <span className="leading-none text-center">{label}</span>
                </Link>
              )
            })}
            {/* Admin tab — only for admins */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 text-[9.5px] sm:text-xs font-semibold border-b-2 transition-all duration-200 ${
                  pathname === '/admin'
                    ? 'text-amber-300 border-amber-400'
                    : 'text-amber-400/50 border-transparent hover:text-amber-300 hover:border-amber-500/40'
                }`}
              >
                <span className="text-sm sm:text-xs opacity-70">🔐</span>
                <span className="leading-none">ניהול</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
