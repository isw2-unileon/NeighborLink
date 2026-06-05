import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import notificacionIcon from '../assets/notificacion.jpg';
import { notificationsApi } from '../lib/notifications';
import type { Notification } from '../types';

function formatNotificationText(notification: Notification): string {
    switch (notification.type) {
        case 'listing_created':
            return `Se ha creado tu anuncio: ${String(notification.payload.listing_title ?? 'listing')}`;
        case 'transaction_accepted':
            return `Han aceptado una solicitud de ${String(notification.payload.listing_title ?? 'un listing')}`;
        case 'transaction_rejected':
            return `Han rechazado una solicitud de ${String(notification.payload.listing_title ?? 'un listing')}`;
        case 'chat_opened':
            return `Se ha abierto un chat para reservar tu objeto: ${String(notification.payload.listing_title ?? 'tu listing')}`;
        case 'points_refunded':
            return `¡Reembolso recibido! Has recibido ${notification.payload.points} puntos por una incidencia en: ${notification.payload.listing_title}`;
        case 'dispute_created':
            return `Nueva incidencia reportada en: ${notification.payload.listing_title}. Revisión requerida.`;
        case 'listing_deleted_by_admin':
            return `Tu anuncio '${notification.payload.listing_title}' ha sido eliminado por un administrador. Motivo: ${notification.payload.reason}`;
        case 'message_received':
            return 'Tienes un nuevo mensaje';
        default:
            return 'Tienes una nueva notificación';
    }
}

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const isChatDetail = /^\/transactions\/[^/]+\/chat/.test(location.pathname);

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const notificationsRef = useRef<HTMLDivElement>(null);

    const hasUnreadNotifications = unreadCount > 0;
    const safeNotifications = Array.isArray(notifications) ? notifications : [];

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

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

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(async () => {
            try {
                const count = await notificationsApi.unreadCount();
                setUnreadCount(count);
            } catch {
                // silencioso
            }
        }, 30_000);
        return () => clearInterval(interval);
    }, [user]);

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        try {
            setLoadingNotifications(true);
            const [items, count] = await Promise.all([
                notificationsApi.list(20),
                notificationsApi.unreadCount(),
            ]);
            setNotifications(Array.isArray(items) ? items : []);
            setUnreadCount(count);
        } catch (error) {
            console.error('Error cargando notificaciones', error);
        } finally {
            setLoadingNotifications(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        loadNotifications();
    }, [user, loadNotifications]);

    async function handleOpenNotifications() {
        const nextOpen = !isNotificationsOpen;
        setIsNotificationsOpen(nextOpen);
        if (nextOpen) {
            await loadNotifications();
        }
    }

    async function handleMarkAsRead(id: string, alreadyRead: boolean) {
        if (alreadyRead) return;
        try {
            await notificationsApi.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marcando notificación como leída', error);
        }
    }

    async function handleMarkAllAsRead() {
        try {
            await notificationsApi.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marcando todas como leídas', error);
        }
    }

    return (
        <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)]">

            {/* ── Navbar ── */}
            <nav className="flex-shrink-0 sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                    <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">N</span>
                        <span className="font-editorial text-xl">NeighborLink</span>
                    </Link>

                    <div className="relative flex items-center gap-3" ref={notificationsRef}>
                        {user ? (
                            <>
                                {/* Notificaciones */}
                                <button
                                    type="button"
                                    onClick={handleOpenNotifications}
                                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                    aria-label="Ver notificaciones"
                                >
                                    <img src={notificacionIcon} alt="Notificaciones" className="h-5 w-5" />
                                    {hasUnreadNotifications && (
                                        <span className="absolute top-2 right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white ring-2 ring-white">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Chats */}
                                <Link
                                    to="/chats"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100"
                                    aria-label="Chats"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.52 3.66 1.424 5.168L2.1 21.1a.75.75 0 00.943.943l3.932-1.324A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zM8 13a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                </Link>

                                {/* Perfil */}
                                <Link
                                    to="/profile"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100"
                                    aria-label="Mi perfil"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM4 19.5A7.5 7.5 0 0120 19.5a.75.75 0 01-.75.75H4.75A.75.75 0 014 19.5z" />
                                    </svg>
                                </Link>

                                {/* Salir */}
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#b9382e] hover:bg-red-50"
                                    aria-label="Cerrar sesión"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    Entrar
                                </Link>
                                <Link
                                    to="/register"
                                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-95"
                                >
                                    Registrarse
                                </Link>
                            </>
                        )}

                        {/* Panel de notificaciones */}
                        {user && isNotificationsOpen && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
                                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                                    <div className="text-sm font-semibold text-gray-700">
                                        Notificaciones
                                    </div>
                                    {safeNotifications.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleMarkAllAsRead}
                                            className="text-xs text-[var(--accent)] hover:brightness-75"
                                        >
                                            Marcar todas como leídas
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-96 overflow-y-auto">
                                    {loadingNotifications ? (
                                        <div className="px-4 py-4 text-sm text-gray-500">
                                            Cargando notificaciones...
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="px-4 py-4 text-sm text-gray-500">
                                            No hay notificaciones nuevas.
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {safeNotifications.map((notification) => (
                                                <li
                                                    key={notification.id}
                                                    className={notification.read ? 'bg-white' : 'bg-teal-50'}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkAsRead(notification.id, notification.read)}
                                                        className="w-full px-4 py-3 text-left transition hover:bg-gray-50"
                                                    >
                                                        <p className="text-sm text-gray-800">
                                                            {formatNotificationText(notification)}
                                                        </p>
                                                        <p className="mt-1 text-xs text-gray-400">
                                                            {new Date(notification.created_at).toLocaleString('es-ES')}
                                                        </p>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── Contenido principal ── */}
            {isChatDetail ? (
                // El chat detail necesita ocupar todo el espacio restante sin padding ni max-width
                <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <Outlet />
                </main>
            ) : (
                // El resto de páginas usan el layout normal con padding y max-width
                <main className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="mx-auto w-full max-w-6xl">
                        <Outlet />
                    </div>
                </main>
            )}

        </div>
    );
}