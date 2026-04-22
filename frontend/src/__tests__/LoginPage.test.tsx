import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import LoginPage from '../pages/LoginPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
})

// Helper — mismo patrón que PrivateRoute.test.tsx
function renderLoginPage() {
    return render(
        <MemoryRouter initialEntries={['/login']}>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/listings" element={<p>Página listings</p>} />
                </Routes>
            </AuthProvider>
        </MemoryRouter>
    )
}

describe('LoginPage', () => {
    it('renderiza los campos de email y contraseña', () => {
        renderLoginPage()
        expect(screen.getByLabelText('Email')).toBeDefined()
        expect(screen.getByLabelText('Contraseña')).toBeDefined()
    })

    it('renderiza el botón de submit', () => {
        renderLoginPage()
        expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDefined()
    })

    it('redirige a /listings tras login exitoso', async () => {
        const user = userEvent.setup()
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                token: 'jwt-token',
                user: { id: '1', email: 'a@a.com', name: 'Mario', avatar_url: '', reputation_score: 0, created_at: '', address: ''},
            }),
        })

        renderLoginPage()
        await user.type(screen.getByLabelText('Email'), 'a@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

        await waitFor(() => {
            expect(screen.getByText('Página listings')).toBeDefined()
        })
    })

    it('guarda el token en localStorage tras login exitoso', async () => {
        const user = userEvent.setup()
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                token: 'jwt-token',
                user: { id: '1', email: 'a@a.com', name: 'Mario', avatar_url: '', reputation_score: 0, created_at: '', address: ''},
            }),
        })

        renderLoginPage()
        await user.type(screen.getByLabelText('Email'), 'a@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe('jwt-token')
        })
    })

    it('muestra error cuando las credenciales son inválidas', async () => {
        const user = userEvent.setup()
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Email o contraseña incorrectos' }),
        })

        renderLoginPage()
        await user.type(screen.getByLabelText('Email'), 'malo@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'wrongpass')
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

        await waitFor(() => {
            expect(screen.getByText('Email o contraseña incorrectos')).toBeDefined()
        })
    })

    it('el botón muestra "Cargando…" mientras la petición está en vuelo', async () => {
        const user = userEvent.setup()
        // Promesa que nunca resuelve — simula petición lenta
        mockFetch.mockReturnValueOnce(new Promise(() => { }))

        renderLoginPage()
        await user.type(screen.getByLabelText('Email'), 'a@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

        expect(screen.getByText('Cargando…')).toBeDefined()
    })
})