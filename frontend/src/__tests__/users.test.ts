import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
    vi.resetModules()
})

const fakeUser = {
    id: 'u1', name: 'Ana', email: 'ana@test.com',
    avatar_url: '', address: 'Calle Mayor, León', reputation_score: 4, created_at: '',
}

describe('usersApi', () => {
    it('getUser llama a GET /users/:id y devuelve el usuario', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: fakeUser }) })
        const { usersApi } = await import('../lib/users')
        const result = await usersApi.getUser('u1')
        expect(result).toEqual(fakeUser)
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/users/u1'), expect.any(Object))
    })

    it('updateMe llama a PUT /users/me y devuelve el usuario actualizado', async () => {
        const updated = { ...fakeUser, name: 'Ana López' }
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: updated }) })
        const { usersApi } = await import('../lib/users')
        const result = await usersApi.updateMe({ name: 'Ana López', address: 'Calle Mayor, León' })
        expect(result).toEqual(updated)
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/users/me'), expect.objectContaining({ method: 'PUT' }))
    })

    it('uploadAvatar envía FormData con el fichero y devuelve el usuario', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: fakeUser }) })
        const { usersApi } = await import('../lib/users')
        const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
        const result = await usersApi.uploadAvatar(file)
        expect(result).toEqual(fakeUser)
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/users/me/avatar'),
            expect.objectContaining({ method: 'POST' })
        )
    })

    it('uploadAvatar incluye Authorization header cuando hay token', async () => {
        localStorage.setItem('token', 'tok-123')
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: fakeUser }) })
        const { usersApi } = await import('../lib/users')
        const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
        await usersApi.uploadAvatar(file)
        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
        const headers = (options.headers ?? {}) as Record<string, string>
        expect(headers['Authorization']).toBe('Bearer tok-123')
    })

    it('uploadAvatar lanza error si la respuesta no es ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false, status: 413,
            json: async () => ({ error: 'File too large' }),
        })
        const { usersApi } = await import('../lib/users')
        const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
        await expect(usersApi.uploadAvatar(file)).rejects.toThrow('File too large')
    })

    it('uploadAvatar lanza error con HTTP status si el body no parsea', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false, status: 500,
            json: async () => { throw new Error('parse error') },
        })
        const { usersApi } = await import('../lib/users')
        const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
        await expect(usersApi.uploadAvatar(file)).rejects.toThrow('Unknown error')
    })
})