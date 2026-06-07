import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import * as notificationsLib from '../lib/notifications';
import type { Notification } from '../types';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, Outlet: () => <div />, useNavigate: () => vi.fn() };
});

vi.mock('../lib/notifications');
vi.mock('../assets/notificacion.jpg', () => ({ default: 'notificacion.jpg' }));
vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', name: 'Federico' },
        logout: vi.fn(),
    }),
}));

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: 'notif-1',
    user_id: 'user-1',
    type: 'transaction_accepted',
    payload: { listing_title: 'Taladro Bosch' },
    read: false,
    created_at: new Date().toISOString(),
    ...overrides,
});

function renderLayout() {
    return render(
        <MemoryRouter>
            <Layout />
        </MemoryRouter>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([]);
    vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(0);
    vi.mocked(notificationsLib.notificationsApi.markAsRead).mockResolvedValue(undefined);
    vi.mocked(notificationsLib.notificationsApi.markAllAsRead).mockResolvedValue(undefined);
});

describe('Layout — Notificaciones', () => {
    it('muestra el botón de notificaciones en el nav', () => {
        renderLayout();
        expect(screen.getByRole('button', { name: /ver notificaciones/i })).toBeInTheDocument();
    });

    it('no muestra badge si unreadCount es 0', async () => {
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(0);
        renderLayout();
        await waitFor(() => {
            expect(screen.queryByText(/^\d+$|^9\+$/)).not.toBeInTheDocument();
        });
    });

    it('muestra badge con el número de no leídas', async () => {
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(3);
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([]);
        renderLayout();
        await waitFor(() => {
            expect(screen.getByText('3')).toBeInTheDocument();
        });
    });

    it('muestra "9+" cuando hay más de 9 no leídas', async () => {
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(12);
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([]);
        renderLayout();
        await waitFor(() => {
            expect(screen.getByText('9+')).toBeInTheDocument();
        });
    });

    it('abre el dropdown al pulsar el icono de notificaciones', async () => {
        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));
        await waitFor(() => {
            expect(screen.getByText('Notificaciones')).toBeInTheDocument();
        });
    });

    it('muestra "No hay notificaciones nuevas" cuando la lista está vacía', async () => {
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([]);
        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));
        await waitFor(() => {
            expect(screen.getByText(/no hay notificaciones nuevas/i)).toBeInTheDocument();
        });
    });

    it('muestra notificaciones en el dropdown', async () => {
        const notif = makeNotification({ type: 'transaction_accepted', payload: { listing_title: 'Taladro Bosch' } });
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([notif]);
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(1);

        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));

        await waitFor(() => {
            expect(screen.getByText(/ha aceptado la solicitud sobre "taladro bosch"/i)).toBeInTheDocument();
        });
    });

    it('las notificaciones no leídas tienen fondo teal', async () => {
        const notif = makeNotification({ read: false });
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([notif]);
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(1);

        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));

        await waitFor(() => {
            const li = screen.getByText(/ha aceptado/i).closest('li');
            expect(li).toHaveClass('bg-teal-50');
        });
    });

    it('las notificaciones leídas tienen fondo blanco', async () => {
        const notif = makeNotification({ read: true });
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([notif]);
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(0);

        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));

        await waitFor(() => {
            const li = screen.getByText(/ha aceptado/i).closest('li');
            expect(li).toHaveClass('bg-white');
        });
    });

    it('marca una notificación como leída al pulsar en ella', async () => {
        const notif = makeNotification({ read: false });
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue([notif]);
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(1);

        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));

        await waitFor(() => screen.getByText(/ha aceptado/i));
        fireEvent.click(screen.getByText(/ha aceptado/i));

        await waitFor(() => {
            expect(notificationsLib.notificationsApi.markAsRead).toHaveBeenCalledWith('notif-1');
        });
    });

    it('marca todas como leídas al pulsar el botón', async () => {
        const notifs = [makeNotification({ id: 'n1', read: false }), makeNotification({ id: 'n2', read: false })];
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue(notifs);
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(2);

        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));

        await waitFor(() => screen.getByText(/marcar todas como leídas/i));
        fireEvent.click(screen.getByText(/marcar todas como leídas/i));

        await waitFor(() => {
            expect(notificationsLib.notificationsApi.markAllAsRead).toHaveBeenCalled();
        });
    });

    it('el badge desaparece tras marcar todas como leídas', async () => {
        const notifs = [makeNotification({ read: false })];
        vi.mocked(notificationsLib.notificationsApi.list).mockResolvedValue(notifs);
        vi.mocked(notificationsLib.notificationsApi.unreadCount).mockResolvedValue(1);

        renderLayout();

        await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));
        await waitFor(() => screen.getByText(/marcar todas como leídas/i));
        fireEvent.click(screen.getByText(/marcar todas como leídas/i));

        await waitFor(() => {
            expect(screen.queryByText('1')).not.toBeInTheDocument();
        });
    });

    it('cierra el dropdown al hacer click fuera', async () => {
        renderLayout();
        fireEvent.click(screen.getByRole('button', { name: /ver notificaciones/i }));
        await waitFor(() => screen.getByText('Notificaciones'));

        fireEvent.mouseDown(document.body);

        await waitFor(() => {
            expect(screen.queryByText('Notificaciones')).not.toBeInTheDocument();
        });
    });
});