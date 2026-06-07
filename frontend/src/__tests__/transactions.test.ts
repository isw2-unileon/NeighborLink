import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transactionsApi } from '../lib/transactions';

const fetchMock = vi.fn();
global.fetch = fetchMock;

beforeEach(() => {
    localStorage.setItem('token', 'fake-jwt-token');
});

afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
});

const mockTransaction = {
    id: 'tx-1',
    listing_id: 'listing-1',
    borrower_id: 'user-1',
    status: 'pending' as const,
    total_charged_cents: 8000,
    start_date: '2026-06-10',
    end_date: '2026-06-14',
    agreed_at: null,
    handover_at: null,
    return_at: null,
};

describe('transactionsApi.getById', () => {
    it('llama al endpoint correcto y devuelve la transacción', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: mockTransaction }),
        });

        const result = await transactionsApi.getById('tx-1');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/transactions/tx-1'),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt-token' }),
            })
        );
        expect(result.id).toBe('tx-1');
        expect(result.status).toBe('pending');
    });

    it('lanza error si la respuesta no es ok', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'not found' }),
        });

        await expect(transactionsApi.getById('tx-1')).rejects.toThrow('not found');
    });

    it('lanza error de red si fetch falla', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        await expect(transactionsApi.getById('tx-1')).rejects.toThrow('Network error');
    });
});

describe('transactionsApi.pay', () => {
    it('envía PUT con el importe correcto (pago con tarjeta)', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ client_secret: 'pi_secret_abc' }),
        });

        await transactionsApi.pay('tx-1', 5000, 'pm_123');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/transactions/tx-1/pay'),
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({
                    deposit_amount_cents: 5000,
                    payment_method_id: 'pm_123',
                    payment_method: 'card',
                }),
            })
        );
    });

    it('envía payment_method=points cuando se paga con puntos', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ client_secret: '' }),
        });

        await transactionsApi.pay('tx-1', 5000, null, 'points');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/transactions/tx-1/pay'),
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({
                    deposit_amount_cents: 5000,
                    payment_method_id: null,
                    payment_method: 'points',
                }),
            })
        );
    });

    it('devuelve el clientSecret del backend', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ client_secret: 'pi_secret_abc' }),
        });

        const result = await transactionsApi.pay('tx-1', 5000, 'pm_123', 'card');

        expect(result.clientSecret).toBe('pi_secret_abc');
    });

    it('lanza error si la respuesta no es ok', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'transaction not in awaiting_payment state' }),
        });

        await expect(transactionsApi.pay('tx-1', 5000, 'pm_123', 'card')).rejects.toThrow('awaiting_payment');
    });
});
