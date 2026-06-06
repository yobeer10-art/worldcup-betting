import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AdminProvider } from './context/AdminContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import MatchesPage from './pages/MatchesPage'
import GroupsPage from './pages/GroupsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import BracketPage from './pages/BracketPage'
import AdminPage from './pages/AdminPage'
import ChampionPage from './pages/ChampionPage'

export default function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/"           element={<HomePage />}      />
              <Route path="/matches"    element={<MatchesPage />}   />
              <Route path="/groups"     element={<GroupsPage />}    />
              <Route path="/bracket"    element={<BracketPage />}   />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/auth"       element={<AuthPage />}      />
              <Route path="/admin"      element={<AdminPage />}     />
              <Route path="/champion"   element={<ChampionPage />}  />
              <Route path="*"           element={<HomePage />}      />
            </Routes>
          </div>
        </BrowserRouter>
      </AdminProvider>
    </AuthProvider>
  )
}
