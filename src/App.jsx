import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext'
import { AdminProvider }   from './context/AdminContext'
import AuthPage            from './pages/AuthPage'
import HomePage            from './pages/HomePage'
import DailyBetsPage       from './pages/DailyBetsPage'
import SpecialPage         from './pages/SpecialPage'
import BracketPage         from './pages/BracketPage'
import LeaderboardPage     from './pages/LeaderboardPage'
import AdminPage           from './pages/AdminPage'

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

              {/* ── Legacy redirects ─────────────────────── */}
              <Route path="/champion"      element={<Navigate to="/special"  replace />} />
              <Route path="/pretournament" element={<Navigate to="/special"  replace />} />
              <Route path="/tables"        element={<Navigate to="/"         replace />} />
              <Route path="/groups"        element={<Navigate to="/"         replace />} />

              {/* ── Catch-all ───────────────────────────── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AdminProvider>
    </AuthProvider>
  )
}
