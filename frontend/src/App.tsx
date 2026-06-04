import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ListingsPage from './pages/listings/ListingsPage'
import ListingsDetailPage from './pages/listings/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import ProfilePage from './pages/ProfilePage'
import EditProfilePage from './pages/EditProfilePage'
import HandoverPage from './pages/HandoverPage'
import ReturnPage from './pages/ReturnPage'
import ChatsPage from './pages/chats/ChatsPage'
import ChatDetailPage from './pages/chats/ChatDetailPage'
import BorrowerHandoverPage from './pages/BorrowerHandoverPage'
import BorrowerReturnPage from './pages/BorrowerReturnPage'
import OtherUserProfilePage from './pages/OtherUserProfilePage'

// Redirige a /listings si ya hay sesión, si no muestra la página pasada
function PublicHome() {
  const { token } = useAuth();
  return token ? <Navigate to="/listings" replace /> : <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PublicHome />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<PrivateRoute />}>
              <Route path="/listings" element={<ListingsPage />} />
              <Route path="/listings/new" element={<CreateListingPage />} />
              <Route path="/listings/:id" element={<ListingsDetailPage />} />
              <Route path="/listings/:id/handover" element={<HandoverPage />} />
              <Route path="/listings/:id/return" element={<ReturnPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/edit" element={<EditProfilePage />} />
              <Route path="/chats" element={<ChatsPage />} />
              <Route path="/transactions/:id/chat" element={<ChatDetailPage />} />
              <Route path="/reservations/:id/handover" element={<BorrowerHandoverPage />} />
              <Route path="/reservations/:id/return" element={<BorrowerReturnPage />} />
              <Route path="/users/:id" element={<OtherUserProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}