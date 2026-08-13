import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CatalogPage from './pages/CatalogPage'
import CarDetailPage from './pages/CarDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<CatalogPage />} />
        <Route path="/car/:id" element={<CarDetailPage />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
