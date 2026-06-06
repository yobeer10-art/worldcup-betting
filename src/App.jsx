import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext'
import { AdminProvider }   from './context/AdminContext'
import AuthPage            from './pages/AuthPage'
import HomePage            from './pages/HomePage'
import MatchesPage         from './pages/MatchesPage'
import ChampionPage        from './pages/ChampionPage'
import BracketPage         from './pages/BracketPage'
import TablesPage          from './pages/TablesPage'
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
              <Route path="/"            element={<HomePage />}      />
              <Route path="/matches"     element={<MatchesPage />}   />
              <Route path="/champion"    element={<ChampionPage />}  />
              <Route path="/bracket"     element={<BracketPage />}   />
              <Route path="/tables"      element={<TablesPage />}    />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/auth"        element={<AuthPage />}      />
              <Route path="/admin"       element={<AdminPage />}     />

              {/* ── Legacy / old URLs ────────────────────── */}
              <Route path="/groups"        element={<Navigate to="/tables"   replace />} />
              <Route path="/pretournament" element={<Navigate to="/champion" replace />} />

              {/* ── Catch-all ───────────────────────────── */}
              <Route path="*" element={<Navigate to="/matches" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AdminProvider>
    </AuthProvider>
  )
}
