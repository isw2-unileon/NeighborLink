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
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
            <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                    <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">N</span>
                        <span className="font-editorial text-xl">NeighborLink</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        {user ? (
                            <>
                                <Link to="/listings" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    Explorar
                                </Link>
                                <Link to="/chats" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    Chats
                                </Link>
                                <Link to="/profile" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    {user.name}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm text-[#b9382e] hover:text-[#8f2a23]"
                                >
                                    Salir
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    Entrar
                                </Link>
                                <Link
                                    to="/register"
                                    className="text-sm rounded-full bg-[var(--accent)] px-4 py-2 font-medium text-white shadow-sm hover:brightness-95"
                                >
                                    Registrarse
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Outlet renderiza la página hija activa */}
            <main className="min-h-screen px-4 py-6">
                <div className="mx-auto w-full max-w-6xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}