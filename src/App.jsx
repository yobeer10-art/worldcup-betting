import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import MatchesPage from './pages/MatchesPage'
import GroupsPage from './pages/GroupsPage'
import LeaderboardPage from './pages/LeaderboardPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
