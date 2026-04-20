import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import RegisterPage from '../pages/RegisterPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
})

function renderRegisterPage() {
    return render(
        <MemoryRouter initialEntries={['/register']}>
            <AuthProvider>
                <Routes>
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/listings" element={<p>Página listings</p>} />
                </Routes>
            </AuthProvider>
        </MemoryRouter>
    )
}

describe('RegisterPage', () => {
    it('renderiza los campos de nombre, email y contraseña', () => {
        renderRegisterPage()
        expect(screen.getByLabelText('Nombre')).toBeDefined()
        expect(screen.getByLabelText('Email')).toBeDefined()
        expect(screen.getByLabelText('Contraseña')).toBeDefined()
    })

    it('renderiza el botón de submit', () => {
        renderRegisterPage()
        expect(screen.getByRole('button', { name: 'Registrarse' })).toBeDefined()
    })

    it('redirige a /listings tras registro exitoso', async () => {
        const user = userEvent.setup()
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                token: 'jwt-token',
                user: { id: '1', email: 'nuevo@a.com', name: 'Nuevo', avatar_url: '', reputation_score: 0, created_at: '' },
            }),
        })

        renderRegisterPage()
        await user.type(screen.getByLabelText('Nombre'), 'Nuevo')
        await user.type(screen.getByLabelText('Email'), 'nuevo@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Registrarse' }))

        await waitFor(() => {
            expect(screen.getByText('Página listings')).toBeDefined()
        })
    })

    it('guarda el token en localStorage tras registro exitoso', async () => {
        const user = userEvent.setup()
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                token: 'jwt-token',
                user: { id: '1', email: 'nuevo@a.com', name: 'Nuevo', avatar_url: '', reputation_score: 0, created_at: '' },
            }),
        })

        renderRegisterPage()
        await user.type(screen.getByLabelText('Nombre'), 'Nuevo')
        await user.type(screen.getByLabelText('Email'), 'nuevo@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Registrarse' }))

        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe('jwt-token')
        })
    })

    it('muestra error cuando el email ya está registrado', async () => {
        const user = userEvent.setup()
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({ error: 'Este email ya está registrado' }),
        })

        renderRegisterPage()
        await user.type(screen.getByLabelText('Nombre'), 'Mario')
        await user.type(screen.getByLabelText('Email'), 'existente@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Registrarse' }))

        await waitFor(() => {
            expect(screen.getByText('Este email ya está registrado')).toBeDefined()
        })
    })

    it('el botón muestra "Cargando…" mientras la petición está en vuelo', async () => {
        const user = userEvent.setup()
        mockFetch.mockReturnValueOnce(new Promise(() => { }))

        renderRegisterPage()
        await user.type(screen.getByLabelText('Nombre'), 'Mario')
        await user.type(screen.getByLabelText('Email'), 'a@a.com')
        await user.type(screen.getByLabelText('Contraseña'), 'password123')
        await user.click(screen.getByRole('button', { name: 'Registrarse' }))

        expect(screen.getByText('Cargando…')).toBeDefined()
    })
})