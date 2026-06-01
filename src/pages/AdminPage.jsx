import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdmin } from '../context/AdminContext'
import Header from '../components/Layout/Header'
import AdminDashboard    from '../components/Admin/AdminDashboard'
import AdminMatchManager from '../components/Admin/AdminMatchManager'
import AdminUserManager  from '../components/Admin/AdminUserManager'
import AdminBracketManager from '../components/Admin/AdminBracketManager'
import Spinner from '../components/UI/Spinner'

const TABS = [
  { id: 'dashboard', label: 'סטטיסטיקות', icon: '📊' },
  { id: 'matches',   label: 'משחקים',      icon: '⚽' },
  { id: 'bracket',   label: 'מדרגי',       icon: '🎯' },
  { id: 'users',     label: 'משתמשים',     icon: '👥' },
]

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-7xl mb-5">🔐</div>
        <h1 className="text-2xl font-extrabold text-slate-800 mb-2">אין גישה</h1>
        <p className="text-slate-500 mb-6">
          עמוד זה מיועד למנהלים בלבד.<br />
          אם אתה מנהל, וודא שאתה מחובר עם כתובת המייל הנכונה.
        </p>
        <Link
          to="/"
          className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-colors"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user }               = useAuth()
  const { isAdmin, adminLoading } = useAdmin()
  const [tab, setTab]          = useState('dashboard')

  if (adminLoading) {
    return (
      <>
        <Header />
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      </>
    )
  }

  if (!user || !isAdmin) {
    return (
      <>
        <Header />
        <AccessDenied />
      </>
    )
  }

  return (
    <>
      <Header />

      {/* Admin sub-header */}
      <div className="bg-slate-800 shadow-lg">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-3 py-3 border-b border-slate-700">
            <span className="text-xl">🔐</span>
            <div>
              <h1 className="text-white font-extrabold text-sm leading-none">ממשק ניהול</h1>
              <p className="text-slate-400 text-xs mt-0.5">מונדיאל 2026</p>
            </div>
            <span className="mr-auto text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
              ✅ מנהל
            </span>
          </div>

          <nav className="flex overflow-x-auto scrollbar-none">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 ${
                  tab === id
                    ? 'text-white border-emerald-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'matches'   && <AdminMatchManager />}
        {tab === 'bracket'   && <AdminBracketManager />}
        {tab === 'users'     && <AdminUserManager />}
      </main>
    </>
  )
}
