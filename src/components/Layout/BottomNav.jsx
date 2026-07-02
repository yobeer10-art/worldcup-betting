import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const TABS = [
  { to: '/',            icon: '🏠', label: 'בית'     },
  { to: '/matches',     icon: '⚽', label: 'הימורים', badge: true },
  { to: '/bracket',     icon: '🎯', label: 'ברקט'    },
  { to: '/mybets',      icon: '📋', label: 'שלי'     },
  { to: '/leaderboard', icon: '📊', label: 'דירוג'   },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const { isAdmin }  = useAdmin()
  const { user }     = useAuth()
  const [unbetToday, setUnbetToday] = useState(false)

  useEffect(() => {
    if (!user) { setUnbetToday(false); return }
    let cancelled = false
    async function check() {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
      const start = new Date(`${today}T00:00:00+03:00`).toISOString()
      const end   = new Date(`${today}T23:59:59+03:00`).toISOString()
      const { data: matches } = await supabase
        .from('matches').select('id')
        .eq('status', 'upcoming')
        .gte('match_date', start).lte('match_date', end)
      if (cancelled || !matches?.length) { if (!cancelled) setUnbetToday(false); return }
      const ids = matches.map(m => m.id)
      const { data: bets } = await supabase
        .from('bets').select('match_id')
        .eq('user_id', user.id).in('match_id', ids)
      if (!cancelled) {
        const betIds = new Set(bets?.map(b => b.match_id) ?? [])
        setUnbetToday(ids.some(id => !betIds.has(id)))
      }
    }
    check()
    return () => { cancelled = true }
  }, [user, pathname])

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-[0_-2px_16px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex items-stretch">
        {TABS.map(({ to, icon, label, badge }) => {
          const active     = pathname === to || (to === '/mybets' && pathname === '/digest')
          const showBadge  = badge && unbetToday && !!user
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors duration-150
                          ${active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-[22px] leading-none relative inline-block">
                {icon}
                {showBadge && (
                  <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </span>
              <span className={`text-[8px] font-semibold leading-none text-center px-0.5 ${active ? 'text-emerald-600' : ''}`}>
                {label}
              </span>
              {active && <span className="absolute top-0 inset-x-0 h-[2px] bg-emerald-500 rounded-b-full" />}
            </Link>
          )
        })}

        {isAdmin && (
          <Link
            to="/admin"
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors duration-150
                        ${pathname === '/admin' ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
          >
            <span className="text-[22px] leading-none">🔐</span>
            <span className="text-[8px] font-semibold leading-none">ניהול</span>
            {pathname === '/admin' && <span className="absolute top-0 inset-x-0 h-[2px] bg-amber-400 rounded-b-full" />}
          </Link>
        )}
      </div>
    </nav>
  )
}
