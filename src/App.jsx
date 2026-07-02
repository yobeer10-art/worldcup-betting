import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext'
import { AdminProvider }   from './context/AdminContext'
import BottomNav           from './components/Layout/BottomNav'
import AuthPage            from './pages/AuthPage'
import HomePage            from './pages/HomePage'
import DailyBetsPage       from './pages/DailyBetsPage'
import SpecialPage         from './pages/SpecialPage'
import BracketPage         from './pages/BracketPage'
import LeaderboardPage     from './pages/LeaderboardPage'
import AdminPage           from './pages/AdminPage'
import MyBetsPage         from './pages/MyBetsPage'
import DigestPage         from './pages/DigestPage'

/** Renders BottomNav on every route except /auth and /admin */
function GlobalNav() {
  const { pathname } = useLocation()
  if (pathname === '/auth' || pathname === '/admin') return null
  return <BottomNav />
}

export default function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* ── Main routes ─────────────────────────── */}
              <Route path="/"            element={<HomePage />}        />
              <Route path="/matches"     element={<DailyBetsPage />}   />
              <Route path="/special"     element={<SpecialPage />}     />
              <Route path="/bracket"     element={<BracketPage />}     />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/auth"        element={<AuthPage />}        />
              <Route path="/admin"       element={<AdminPage />}       />
              <Route path="/mybets"     element={<MyBetsPage />}     />
              <Route path="/digest"     element={<Navigate to="/mybets?v=digest" replace />} />

              {/* ── Legacy redirects ─────────────────────── */}
              <Route path="/champion"      element={<Navigate to="/special" replace />} />
              <Route path="/pretournament" element={<Navigate to="/special" replace />} />
              <Route path="/tables"        element={<Navigate to="/"        replace />} />
              <Route path="/groups"        element={<Navigate to="/"        replace />} />

              {/* ── Catch-all ───────────────────────────── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Bottom navigation — visible on all pages except /auth and /admin */}
            <GlobalNav />
          </div>
        </BrowserRouter>
      </AdminProvider>
    </AuthProvider>
  )
}
