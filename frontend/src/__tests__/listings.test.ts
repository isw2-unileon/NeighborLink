import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
    vi.resetModules()
})

const fakeListing = {
    id: 'l1',
    owner_id: 'u1',
    title: 'Taladro',
    description: '',
    photos: [],
    deposit_amount: 10,
    category: 'herramientas',
    status: 'available',
    created_at: '',
}

function okResponse(body: unknown) {
    return { ok: true, status: 200, json: async () => body }
}

describe('listingsApi', () => {
    it('getAll llama a GET /listings y devuelve array', async () => {
        mockFetch.mockResolvedValueOnce(okResponse([fakeListing]))
        const { listingsApi } = await import('../lib/listings')
        const result = await listingsApi.getAll()
        expect(result).toEqual([fakeListing])
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/listings'), expect.any(Object))
    })

    it('getById llama a GET /listings/:id y devuelve el listing', async () => {
        mockFetch.mockResolvedValueOnce(okResponse({ data: fakeListing }))
        const { listingsApi } = await import('../lib/listings')
        const result = await listingsApi.getById('l1')
        expect(result).toEqual(fakeListing)
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/listings/l1'), expect.any(Object))
    })

    it('create llama a POST /listings y devuelve el listing creado', async () => {
        mockFetch.mockResolvedValueOnce(okResponse({ data: fakeListing }))
        const { listingsApi } = await import('../lib/listings')
        const result = await listingsApi.create({
            title: 'Taladro',
            description: '',
            photos: [],
            deposit_amount: 10,
            category: 'herramientas',
            status: 'available',
        })
        expect(result).toEqual(fakeListing)
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/listings'),
            expect.objectContaining({ method: 'POST' })
        )
    })

    it('update llama a PUT /listings/:id y devuelve el listing actualizado', async () => {
        mockFetch.mockResolvedValueOnce(okResponse({ data: fakeListing }))
        const { listingsApi } = await import('../lib/listings')
        const result = await listingsApi.update('l1', {
            title: 'Taladro',
            description: '',
            photos: [],
            deposit_amount: 10,
            category: 'herramientas',
            status: 'available',
        })
        expect(result).toEqual(fakeListing)
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/listings/l1'),
            expect.objectContaining({ method: 'PUT' })
        )
    })

    it('delete llama a DELETE /listings/:id y devuelve undefined', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
        const { listingsApi } = await import('../lib/listings')
        const result = await listingsApi.delete('l1')
        expect(result).toBeUndefined()
    })

    it('getByOwner llama a GET /users/:id/listings y devuelve array', async () => {
        mockFetch.mockResolvedValueOnce(okResponse({ data: [fakeListing] }))
        const { listingsApi } = await import('../lib/listings')
        const result = await listingsApi.getByOwner('u1')
        expect(result).toEqual([fakeListing])
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/users/u1/listings'), expect.any(Object))
    })

    it('uploadPhoto envía FormData y devuelve el listing actualizado', async () => {
        mockFetch.mockResolvedValueOnce(okResponse({ data: fakeListing }))
        const { listingsApi } = await import('../lib/listings')
        const file = new File(['img'], 'foto.jpg', { type: 'image/jpeg' })
        const result = await listingsApi.uploadPhoto('l1', file)
        expect(result).toEqual(fakeListing)
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/listings/l1/photos'),
            expect.objectContaining({ method: 'POST' })
        )
    })

    it('uploadPhoto lanza error si la respuesta no es ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Bad request' }),
        })
        const { listingsApi } = await import('../lib/listings')
        const file = new File(['img'], 'foto.jpg', { type: 'image/jpeg' })
        await expect(listingsApi.uploadPhoto('l1', file)).rejects.toThrow('Bad request')
    })

    it('uploadPhoto lanza error con HTTP status si el body no parsea', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error('parse error')
            },
        })
        const { listingsApi } = await import('../lib/listings')
        const file = new File(['img'], 'foto.jpg', { type: 'image/jpeg' })
        await expect(listingsApi.uploadPhoto('l1', file)).rejects.toThrow('Unknown error')
    })

    //sobre filtros: 

    it('getAll añade category al query string', async () => {
        mockFetch.mockResolvedValueOnce(okResponse([]))
        const { listingsApi } = await import('../lib/listings')

        await listingsApi.getAll({ category: 'herramientas' })

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/listings?category=herramientas'),
            expect.any(Object)
        )
    })

    it('getAll añade varios filtros al query string', async () => {
        mockFetch.mockResolvedValueOnce(okResponse([]))
        const { listingsApi } = await import('../lib/listings')

        await listingsApi.getAll({
            category: 'herramientas',
            deposit: '50',
            status: 'available',
        })

        const call = mockFetch.mock.calls[0]
        expect(call).toBeDefined()
        const url = call[0] as string

        expect(url).toContain('/listings?')
        expect(url).toContain('category=herramientas')
        expect(url).toContain('deposit=50')
        expect(url).toContain('status=available')
    })

    it('getAll no añade filtros vacíos al query string', async () => {
        mockFetch.mockResolvedValueOnce(okResponse([]))
        const { listingsApi } = await import('../lib/listings')

        await listingsApi.getAll({
            category: '',
            deposit: '',
            status: undefined,
        })

        const call = mockFetch.mock.calls[0]
        expect(call).toBeDefined()
        const url = call[0] as string

        expect(url).toMatch(/\/listings$/)
    })
})