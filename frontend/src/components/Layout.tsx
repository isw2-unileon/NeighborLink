import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';
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
        case 'message_received':
            return 'Tienes un nuevo mensaje';
        default:
            return 'Tienes una nueva notificación';
    }
}

// Layout — componente estructural que envuelve todas las páginas
export default function Layout() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

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

    useEffect(() => {
        if (!user) return;
        loadNotifications();
    }, [user]);

    async function loadNotifications() {
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
    }

    useEffect(() => {
        if (!user) return;
        loadNotifications();
    }, [user]);

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
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
            <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                    <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">N</span>
                        <span className="font-editorial text-xl">NeighborLink</span>
                    </Link>

                    <div className="relative flex items-center gap-4" ref={notificationsRef}>
                        {user ? (
                            <>
                                <Link to="/listings" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    Explorar
                                </Link>
                                <Link to="/chats" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    Chats
                                </Link>

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

                                <Link to="/profile" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                                    {user.name}
                                </Link>

                                <button
                                    type="button"
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
                                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-95"
                                >
                                    Registrarse
                                </Link>
                            </>
                        )}

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
                                            {safeNotifications.map((notification) => (<li
                                                key={notification.id}
                                                className={notification.read ? 'bg-white' : 'bg-teal-50'}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleMarkAsRead(notification.id, notification.read)
                                                    }
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

            <main className="min-h-screen px-4 py-6">
                <div className="mx-auto w-full max-w-6xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}