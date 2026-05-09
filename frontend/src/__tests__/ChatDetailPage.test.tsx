import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChatDetailPage from '../pages/chats/ChatDetailPage';
import { messagesApi } from '../lib/messages';
import { listingsApi } from '../lib/listings';
import { api } from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../lib/messages');
vi.mock('../lib/listings');
vi.mock('../lib/api');

const mockUser = { id: 'user-1', name: 'Test', email: 'test@test.com' };

const mockMessages = [
    {
        id: 'msg-1',
        transaction_id: 'tx-abc',
        sender_id: 'user-1',
        content: 'Hola!',
        listing_title: 'Taladro',
        listing_photo: null,
        created_at: '2026-05-01T10:00:00Z',
    },
    {
        id: 'msg-2',
        transaction_id: 'tx-abc',
        sender_id: 'user-2',
        content: 'Buenas!',
        listing_title: 'Taladro',
        listing_photo: null,
        created_at: '2026-05-01T10:01:00Z',
    },
];

const mockListing = { id: 'listing-1', title: 'Taladro Bosch', photos: [], listing_id: 'listing-1' };

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/transactions/tx-abc/chat']}>
            <Routes>
                <Route path="/transactions/:id/chat" element={<ChatDetailPage />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('ChatDetailPage', () => {
    beforeEach(() => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: mockUser } as any);
        vi.mocked(api.get).mockResolvedValue({ data: { listing_id: 'listing-1' } } as any);
        vi.mocked(listingsApi.getById).mockResolvedValue(mockListing as any);
    });

    it('muestra el estado vacío cuando no hay mensajes', async () => {
        vi.mocked(messagesApi.getByTransaction).mockResolvedValue([]);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('No hay mensajes aún. ¡Empieza la conversación!')).toBeInTheDocument();
        });
    });

    it('renderiza los mensajes cuando la API responde', async () => {
        vi.mocked(messagesApi.getByTransaction).mockResolvedValue(mockMessages as any);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Hola!')).toBeInTheDocument();
            expect(screen.getByText('Buenas!')).toBeInTheDocument();
        });
    });

    it('muestra el título del listing en el header', async () => {
        vi.mocked(messagesApi.getByTransaction).mockResolvedValue([]);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Taladro Bosch')).toBeInTheDocument();
        });
    });

    it('el botón Enviar está deshabilitado si el input está vacío', async () => {
        vi.mocked(messagesApi.getByTransaction).mockResolvedValue([]);
        renderPage();
        await waitFor(() => {
            const btn = screen.getByRole('button', { name: 'Enviar' });
            expect(btn).toBeDisabled();
        });
    });

    it('envía un mensaje y lo añade a la lista', async () => {
        vi.mocked(messagesApi.getByTransaction).mockResolvedValue([]);
        vi.mocked(messagesApi.create).mockResolvedValue({
            id: 'msg-new',
            transaction_id: 'tx-abc',
            sender_id: 'user-1',
            content: 'Nuevo mensaje',
            created_at: '2026-05-01T10:05:00Z',
        } as any);
        renderPage();

        await waitFor(() => screen.getByPlaceholderText('Escribe un mensaje…'));

        fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje…'), {
            target: { value: 'Nuevo mensaje' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        await waitFor(() => {
            expect(screen.getByText('Nuevo mensaje')).toBeInTheDocument();
        });
    });

    it('muestra error si falla la carga de mensajes', async () => {
        vi.mocked(messagesApi.getByTransaction).mockRejectedValue(new Error('fail'));
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('No se pudieron cargar los mensajes')).toBeInTheDocument();
        });
    });
});