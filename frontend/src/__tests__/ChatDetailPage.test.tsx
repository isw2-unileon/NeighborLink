import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChatDetailPage from '../pages/chats/ChatDetailPage';
import type { Listing } from '../types';
import * as messagesLib from '../lib/messages';
import * as listingsLib from '../lib/listings';
import { api } from '../lib/api';

vi.mock('../lib/messages');
vi.mock('../lib/listings');
vi.mock('../lib/api', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}));

// ── userId mutable para cambiar entre owner y borrower por test ──
let currentUserId = 'user-borrower';
vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: currentUserId, name: 'Test' } }),
}));

const OWNER_ID = 'user-owner';
const BORROWER_ID = 'user-borrower';
const TX_ID = 'tx-abc-123';

const mockListing = {
    id: 'listing-1',
    owner_id: OWNER_ID,
    title: 'Taladro Bosch',
    description: 'Taladro profesional',
    deposit_amount: 50,
    status: 'available',
    category: 'tools',
    created_at: new Date().toISOString(),
    photos: [],
    owner_lat: 0,
    owner_lon: 0,
} as Listing;

const mockTransaction = {
    id: TX_ID,
    listing_id: 'listing-1',
    borrower_id: BORROWER_ID,
    status: 'pending' as const,
    total_charged_cents: 5200,
    start_date: '2026-06-10',
    end_date: '2026-06-12',
    agreed_at: null,
    handover_at: null,
    return_at: null,
};

function renderPage() {
    return render(
        <MemoryRouter initialEntries={[`/transactions/${TX_ID}/chat`]}>
            <Routes>
                <Route path="/transactions/:id/chat" element={<ChatDetailPage />} />
                <Route path="/chats" element={<div>Lista chats</div>} />
            </Routes>
        </MemoryRouter>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = BORROWER_ID; // por defecto: borrower
    vi.mocked(messagesLib.messagesApi.getByTransaction).mockResolvedValue([]);
    vi.mocked(messagesLib.messagesApi.create).mockResolvedValue({
        id: 'msg-new',
        transaction_id: TX_ID,
        sender_id: BORROWER_ID,
        content: 'Hola',
        created_at: new Date().toISOString(),
    });
    vi.mocked(listingsLib.listingsApi.getById).mockResolvedValue(mockListing);
    vi.mocked(api.get).mockResolvedValue({ data: mockTransaction });
    vi.mocked(api.post).mockResolvedValue({});
});

describe('ChatDetailPage — flujo de transacción', () => {
    it('renderiza el chat con el título del listing', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Taladro Bosch')).toBeInTheDocument();
        });
    });

    it('muestra el ID de transacción acortado en el header', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/tx-abc-1/i)).toBeInTheDocument();
        });
    });

    it('muestra "No hay mensajes aún" cuando no hay mensajes', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/no hay mensajes aún/i)).toBeInTheDocument();
        });
    });

    it('muestra botón Elección solo para el owner cuando status es pending', async () => {
        currentUserId = OWNER_ID;
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /elección/i })).toBeInTheDocument();
        });
    });

    it('NO muestra botón Elección para el borrower', async () => {
        currentUserId = BORROWER_ID; // ya es el default, explícito por claridad
        renderPage();
        await waitFor(() => screen.getByText('Taladro Bosch'));
        expect(screen.queryByRole('button', { name: /elección/i })).not.toBeInTheDocument();
    });

    it('muestra badge ACEPTADO cuando status es awaiting_payment', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { ...mockTransaction, status: 'awaiting_payment' } });
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('ACEPTADO')).toBeInTheDocument();
        });
    });

    it('muestra badge DENEGADO cuando status es cancelled', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { ...mockTransaction, status: 'cancelled' } });
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('DENEGADO')).toBeInTheDocument();
        });
    });

    it('muestra botón Pagar ahora dentro del mensaje del sistema para el borrower', async () => {
        currentUserId = BORROWER_ID;
        vi.mocked(api.get).mockResolvedValue({ data: { ...mockTransaction, status: 'awaiting_payment' } });
        vi.mocked(messagesLib.messagesApi.getByTransaction).mockResolvedValue([
            {
                id: 'sys-1',
                transaction_id: TX_ID,
                sender_id: '00000000-0000-0000-0000-000000000000',
                content: 'El prestador ha aceptado las condiciones propuestas, ahora mete los métodos de pago.',
                created_at: new Date().toISOString(),
            }
        ]);
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/confirmar y pagar fianza/i)).toBeInTheDocument();
        });
    });

    it('NO muestra botón Pagar ahora para el owner', async () => {
        currentUserId = OWNER_ID;
        vi.mocked(api.get).mockResolvedValue({ data: { ...mockTransaction, status: 'awaiting_payment' } });
        vi.mocked(messagesLib.messagesApi.getByTransaction).mockResolvedValue([
            {
                id: 'sys-1',
                transaction_id: TX_ID,
                sender_id: '00000000-0000-0000-0000-000000000000',
                content: 'El prestador ha aceptado las condiciones propuestas, ahora mete los métodos de pago.',
                created_at: new Date().toISOString(),
            }
        ]);
        renderPage();
        await waitFor(() => screen.getByText('Taladro Bosch'));
        expect(screen.queryByText(/confirmar y pagar fianza/i)).not.toBeInTheDocument();
    });

    it('NO muestra botón Pagar ahora cuando status es pending', async () => {
        currentUserId = BORROWER_ID;
        renderPage();
        await waitFor(() => screen.getByText('Taladro Bosch'));
        expect(screen.queryByText(/confirmar y pagar fianza/i)).not.toBeInTheDocument();
    });

    it('el owner puede abrir y cerrar el modal de Elección', async () => {
        currentUserId = OWNER_ID;
        renderPage();

        await waitFor(() => screen.getByRole('button', { name: /elección/i }));
        fireEvent.click(screen.getByRole('button', { name: /elección/i }));

        expect(screen.getByText(/tomar una decisión/i)).toBeInTheDocument();
        expect(screen.getByText(/esta decisión no se podrá deshacer/i)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/cancelar/i));
        expect(screen.queryByText(/tomar una decisión/i)).not.toBeInTheDocument();
    });

    it('tras aceptar, cambia el estado a awaiting_payment y el borrower ve el mensaje del sistema', async () => {
        currentUserId = OWNER_ID;
        renderPage();

        await waitFor(() => screen.getByRole('button', { name: /elección/i }));
        fireEvent.click(screen.getByRole('button', { name: /elección/i }));
        await waitFor(() => screen.getByText(/tomar una decisión/i));
        fireEvent.click(screen.getByRole('button', { name: /aceptar/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(`/transactions/${TX_ID}/decision`, { decision: 'accept' });
        });
        await waitFor(() => {
            expect(screen.getByText('ACEPTADO')).toBeInTheDocument();
        });

        // El owner NO debería ver el mensaje del sistema de pago (según requerimiento)
        expect(screen.queryByText(/el prestador ha aceptado las condiciones/i)).not.toBeInTheDocument();

        // Si cambiamos a borrower, sí debería verlo
        currentUserId = BORROWER_ID;
        cleanup(); // Limpiamos y re-renderizamos como borrower

        // Mocking the accepted state for the re-render
        vi.mocked(api.get).mockResolvedValue({ data: { ...mockTransaction, status: 'awaiting_payment' } });
        vi.mocked(messagesLib.messagesApi.getByTransaction).mockResolvedValue([
            {
                id: 'sys-1',
                transaction_id: TX_ID,
                sender_id: '00000000-0000-0000-0000-000000000000',
                content: 'El prestador ha aceptado las condiciones propuestas, ahora mete los métodos de pago.',
                created_at: new Date().toISOString(),
            }
        ]);

        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/el prestador ha aceptado las condiciones/i)).toBeInTheDocument();
            expect(screen.getByText(/confirmar y pagar fianza/i)).toBeInTheDocument();
        });
    });

    it('tras rechazar, cambia el estado a cancelled y muestra mensaje del sistema', async () => {
        currentUserId = OWNER_ID;
        renderPage();

        await waitFor(() => screen.getByRole('button', { name: /elección/i }));
        fireEvent.click(screen.getByRole('button', { name: /elección/i }));
        await waitFor(() => screen.getByText(/tomar una decisión/i));
        fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));

        await waitFor(() => {
            expect(screen.getByText('DENEGADO')).toBeInTheDocument();
        });
        expect(screen.getByText(/el prestador no ha aceptado/i)).toBeInTheDocument();
    });

    it('envía un mensaje nuevo y lo muestra en el chat', async () => {
        renderPage();
        await waitFor(() => screen.getByPlaceholderText(/escribe un mensaje/i));

        fireEvent.change(screen.getByPlaceholderText(/escribe un mensaje/i), {
            target: { value: 'Hola vecino' },
        });
        fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

        await waitFor(() => {
            expect(messagesLib.messagesApi.create).toHaveBeenCalledWith(TX_ID, 'Hola vecino');
        });
    });

    it('el botón Enviar está deshabilitado si el input está vacío', async () => {
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /enviar/i }));
        expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    });

    it('navega a /chats al pulsar la flecha de volver', async () => {
        renderPage();
        await waitFor(() => screen.getByText('←'));
        fireEvent.click(screen.getByText('←'));
        await waitFor(() => {
            expect(screen.getByText('Lista chats')).toBeInTheDocument();
        });
    });
});