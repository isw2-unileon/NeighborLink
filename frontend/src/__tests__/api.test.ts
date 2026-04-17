import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
})

describe('api', () => {
    it('GET incluye Content-Type application/json', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [] }),
        })

        const { api } = await import('../lib/api')
        await api.get('/test')

        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('GET incluye Authorization header cuando hay token', async () => {
        localStorage.setItem('token', 'test-token-123')
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [] }),
        })

        const { api } = await import('../lib/api')
        await api.get('/test')

        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers['Authorization']).toBe('Bearer test-token-123')
    })

    it('GET no incluye Authorization header sin token', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [] }),
        })

        const { api } = await import('../lib/api')
        await api.get('/test')

        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers['Authorization']).toBeUndefined()
    })

    it('lanza Error con el mensaje del backend cuando la respuesta no es ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not found' }),
        })

        const { api } = await import('../lib/api')
        await expect(api.get('/test')).rejects.toThrow('Not found')
    })

    it('lanza Error con HTTP status si el body no tiene campo error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
        })

        const { api } = await import('../lib/api')
        await expect(api.get('/test')).rejects.toThrow('HTTP 500')
    })
})