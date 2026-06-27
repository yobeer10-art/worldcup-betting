import { Link, useLocation } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'

const TABS = [
  { to: '/',            icon: '🏠', label: 'בית'          },
  { to: '/matches',     icon: '⚽', label: 'הימורים'      },
  { to: '/bracket',     icon: '🎯', label: 'ברקט'         },
  { to: '/digest',      icon: '👥', label: 'ריכוז'        },
  { to: '/mybets',      icon: '📋', label: 'שלי'          },
  { to: '/leaderboard', icon: '📊', label: 'דירוג'        },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const { isAdmin }  = useAdmin()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200
                    shadow-[0_-2px_16px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex items-stretch">
        {TABS.map(({ to, icon, label }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5
                          transition-colors duration-150
                          ${active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-[22px] leading-none">{icon}</span>
              <span className={`text-[8px] font-semibold leading-none text-center px-0.5
                                ${active ? 'text-emerald-600' : ''}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 inset-x-0 h-[2px] bg-emerald-500 rounded-b-full" />
              )}
            </Link>
          )
        })}

        {/* Admin tab — visible only to admins */}
        {isAdmin && (
          <Link
            to="/admin"
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5
                        transition-colors duration-150
                        ${pathname === '/admin' ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
          >
            <span className="text-[22px] leading-none">🔐</span>
            <span className="text-[8px] font-semibold leading-none">ניהול</span>
            {pathname === '/admin' && (
              <span className="absolute top-0 inset-x-0 h-[2px] bg-amber-400 rounded-b-full" />
            )}
          </Link>
        )}
      </div>
    </nav>
  )
}
