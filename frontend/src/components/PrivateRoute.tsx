import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// PrivateRoute — guarda de autenticación
// Si no hay token, redirige a /login preservando la ruta intentada (state.from)
export default function PrivateRoute() {
    const { token } = useAuth();
    return token ? <Outlet /> : <Navigate to="/login" replace />;
}