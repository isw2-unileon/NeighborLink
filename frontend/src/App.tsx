import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ListingsPage from './pages/listings/ListingsPage'
import ListingDetailPage from './pages/listings/ListingDetailPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />

            {/* Rutas protegidas — requieren token */}
            <Route element={<PrivateRoute />}>
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}