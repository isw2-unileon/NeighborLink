import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatsPage from '../pages/chats/ChatsPage';
import { messagesApi } from '../lib/messages';
import * as AuthContext from '../contexts/AuthContext';
import type { Message, User } from '../types';

vi.mock('../lib/messages');

const mockUser: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@test.com',
    address: '',
    avatar_url: '',
    reputation_score: 0,
    created_at: '2026-01-01T00:00:00Z',
};

const mockChats: Message[] = [
    {
        id: 'msg-1',
        transaction_id: 'tx-1',
        sender_id: 'user-1',
        content: 'Hola, cuándo puedo pasar?',
        listing_title: 'Taladro Bosch',
        listing_photo: undefined,
        created_at: '2026-05-01T10:00:00Z',
    },
    {
        id: 'msg-2',
        transaction_id: 'tx-2',
        sender_id: 'user-2',
        content: '',
        listing_title: 'Escalera de mano',
        listing_photo: undefined,
        created_at: '2026-05-02T10:00:00Z',
    },
];

function renderPage() {
    return render(
        <MemoryRouter>
            <ChatsPage />
        </MemoryRouter>
    );
}

describe('ChatsPage', () => {
    beforeEach(() => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: mockUser,
            token: 'fake-token',
            login: vi.fn(),
            logout: vi.fn(),
            updateUser: vi.fn(),
        });
    });

    it('muestra el estado de carga inicial', () => {
        vi.mocked(messagesApi.getActiveChats).mockReturnValue(new Promise(() => { }));
        renderPage();
        expect(screen.getByText('Cargando chats…')).toBeInTheDocument();
    });

    it('renderiza los chats cuando la API responde', async () => {
        vi.mocked(messagesApi.getActiveChats).mockResolvedValue(mockChats);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Taladro Bosch')).toBeInTheDocument();
            expect(screen.getByText('Escalera de mano')).toBeInTheDocument();
        });
    });

    it('muestra "Tú:" cuando el mensaje es del usuario actual', async () => {
        vi.mocked(messagesApi.getActiveChats).mockResolvedValue(mockChats);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/Tú:/)).toBeInTheDocument();
        });
    });

    it('muestra el estado vacío cuando no hay chats', async () => {
        vi.mocked(messagesApi.getActiveChats).mockResolvedValue([]);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('No tienes conversaciones activas.')).toBeInTheDocument();
        });
    });

    it('muestra error si la API falla', async () => {
        vi.mocked(messagesApi.getActiveChats).mockRejectedValue(new Error('fail'));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('No se pudieron cargar los chats')).toBeInTheDocument();
        });
    });

    it('muestra la sección "Sin mensajes" para chats sin contenido', async () => {
        vi.mocked(messagesApi.getActiveChats).mockResolvedValue(mockChats);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Sin mensajes')).toBeInTheDocument();
        });
    });
});