import { assert, describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reservationsApi } from '../lib/reservations';

const fetchMock = vi.fn();
global.fetch = fetchMock;

beforeEach(() => {
    localStorage.setItem('token', 'fake-jwt-token');
});

afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
});

describe('reservationsApi.getAvailability', () => {
    it('llama al endpoint correcto y devuelve los datos', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [{ start_date: '2026-06-01', end_date: '2026-06-03' }],
            }),
        });

        const result = await reservationsApi.getAvailability('listing-1');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/listings/listing-1/availability'),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt-token' }) })
        );
        expect(result).toHaveLength(1);
        assert(result[0] !== undefined); 
        expect(result[0].start_date).toBe('2026-06-01');
    });

    it('lanza error si la respuesta no es ok', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'not found' }),
        });

        await expect(reservationsApi.getAvailability('listing-1')).rejects.toThrow('not found');
    });
});

describe('reservationsApi.reserve', () => {
    it('envía POST con los datos correctos y devuelve la transacción', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { id: 'tx-1' } }),
        });

        const result = await reservationsApi.reserve('listing-1', {
            start_date: '2026-06-10',
            end_date: '2026-06-14',
            payment_method_id: 'simulated',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/listings/listing-1/reserve'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    start_date: '2026-06-10',
                    end_date: '2026-06-14',
                    payment_method_id: 'simulated',
                }),
            })
        );
        expect(result.id).toBe('tx-1');
    });

    it('lanza error si hay solapamiento (409)', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'selected dates overlap with an existing reservation' }),
        });

        await expect(
            reservationsApi.reserve('listing-1', {
                start_date: '2026-06-10',
                end_date: '2026-06-14',
                payment_method_id: 'simulated',
            })
        ).rejects.toThrow('selected dates overlap');
    });

    it('lanza error si no hay token', async () => {
        localStorage.clear();
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'missing token' }),
        });

        await expect(
            reservationsApi.reserve('listing-1', {
                start_date: '2026-06-10',
                end_date: '2026-06-14',
                payment_method_id: 'simulated',
            })
        ).rejects.toThrow('missing token');
    });
});