import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Layout — componente estructural que envuelve todas las páginas
// Patrón: Composite — el Layout compone Navbar + contenido dinámico (Outlet)
export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/');
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <Link to="/" className="text-xl font-bold text-teal-700">
                    NeighborLink
                </Link>
                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <Link to="/listings" className="text-sm text-gray-600 hover:text-teal-700">
                                Explorar
                            </Link>
                            <Link to="/profile" className="text-sm text-gray-600 hover:text-teal-700">
                                {user.name}
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-red-500 hover:text-red-700"
                            >
                                Salir
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-sm text-gray-600 hover:text-teal-700">
                                Entrar
                            </Link>
                            <Link
                                to="/register"
                                className="text-sm bg-teal-700 text-white px-3 py-1 rounded hover:bg-teal-800"
                            >
                                Registrarse
                            </Link>
                        </>
                    )}
                </div>
            </nav>

            {/* Outlet renderiza la página hija activa */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                <Outlet />
            </main>
        </div>
    );
}