import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/', label: 'בית' },
  { to: '/matches', label: 'משחקים' },
  { to: '/leaderboard', label: 'דירוג' },
]

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <header className="bg-green-700 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="font-bold text-lg leading-none">מונדיאל 2026</span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm opacity-80 hidden sm:block max-w-[120px] truncate">
                  {profile?.display_name || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  יציאה
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="text-sm bg-white text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
              >
                כניסה
              </Link>
            )}
          </div>
        </div>

        <nav className="flex border-t border-green-600">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 text-center py-2.5 text-sm font-medium transition-colors ${
                pathname === to
                  ? 'text-white border-b-2 border-white'
                  : 'text-green-200 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
