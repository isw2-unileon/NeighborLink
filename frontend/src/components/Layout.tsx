import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';
import notificacionIcon from '../assets/notificacion.jpg';

// Layout — componente estructural que envuelve todas las páginas
// Patrón: Composite — el Layout compone Navbar + contenido dinámico (Outlet)
export default function Layout() {
    const { user } = useAuth();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const hasUnreadNotifications = false; // Cambia esto cuando tengas notificaciones nuevas/no vistas
    const notificationsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                notificationsRef.current &&
                !notificationsRef.current.contains(event.target as Node)
            ) {
                setIsNotificationsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <Link to="/" className="text-xl font-bold text-teal-700">
                    NeighborLink
                </Link>
                <div className="relative flex items-center gap-4" ref={notificationsRef}>
                    {user ? (
                        <>
                            <Link to="/listings" className="text-sm text-gray-600 hover:text-teal-700">
                                Explorar
                            </Link>
                            <Link to="/chats" className="text-sm text-gray-600 hover:text-teal-700">
                                Chats
                            </Link>
                            <button
                                type="button"
                                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                aria-label="Ver notificaciones"
                            >
                                <img src={notificacionIcon} alt="Notificaciones" className="h-5 w-5" />
                                {hasUnreadNotifications && (
                                    <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                                )}
                            </button>
                            <Link to="/profile" className="text-sm text-gray-600 hover:text-teal-700">
                                {user.name}
                            </Link>
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

                    {user && isNotificationsOpen && (
                        <div className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
                                Notificaciones
                            </div>
                            <div className="px-4 py-4 text-sm text-gray-500">
                                No hay notificaciones nuevas.
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Outlet renderiza la página hija activa */}
            <main className="min-h-screen pl-4">
                <Outlet />
            </main>
        </div>
    );
}