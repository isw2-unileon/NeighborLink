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

async function fillAndSubmit(
    user: ReturnType<typeof userEvent.setup>,
    opts: { name?: string; email?: string; password?: string; street?: string; city?: string; province?: string } = {}
) {
    await user.type(screen.getByLabelText('Nombre'), opts.name ?? 'Nuevo')
    await user.type(screen.getByLabelText('Email'), opts.email ?? 'nuevo@a.com')
    await user.type(screen.getByLabelText('Contraseña'), opts.password ?? 'password123')
    await user.type(screen.getByLabelText('Calle'), opts.street ?? 'Calle Mayor')
    await user.type(screen.getByLabelText('Localidad'), opts.city ?? 'León')
    await user.type(screen.getByLabelText('Provincia'), opts.province ?? 'León')
    await user.click(screen.getByRole('button', { name: 'Registrarse' }))
}

describe('RegisterPage', () => {
    it('renderiza los campos de nombre, email, contraseña y dirección', () => {
        renderRegisterPage()
        expect(screen.getByLabelText('Nombre')).toBeDefined()
        expect(screen.getByLabelText('Email')).toBeDefined()
        expect(screen.getByLabelText('Contraseña')).toBeDefined()
        expect(screen.getByLabelText('Calle')).toBeDefined()
        expect(screen.getByLabelText('Localidad')).toBeDefined()
        expect(screen.getByLabelText('Provincia')).toBeDefined()
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
                user: { id: '1', email: 'nuevo@a.com', name: 'Nuevo', avatar_url: '', reputation_score: 0, created_at: '', address: '' },
            }),
        })

        renderRegisterPage()
        await fillAndSubmit(user)

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
                user: { id: '1', email: 'nuevo@a.com', name: 'Nuevo', avatar_url: '', reputation_score: 0, created_at: '', address: '' },
            }),
        })

        renderRegisterPage()
        await fillAndSubmit(user)

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
        await fillAndSubmit(user, { email: 'existente@a.com', name: 'Mario' })

        await waitFor(() => {
            expect(screen.getByText('Este email ya está registrado')).toBeDefined()
        })
    })

    it('el botón muestra "Cargando…" mientras la petición está en vuelo', async () => {
        const user = userEvent.setup()
        mockFetch.mockReturnValueOnce(new Promise(() => { }))

        renderRegisterPage()
        await fillAndSubmit(user, { name: 'Mario', email: 'a@a.com' })

        expect(screen.getByText('Cargando…')).toBeDefined()
    })

    it('muestra error bajo el campo Calle si contiene números', async () => {
        const user = userEvent.setup()
        renderRegisterPage()
        await fillAndSubmit(user, { street: 'Calle Mayor 5' })

        expect(screen.getByText('Este campo solo admite letras. No incluyas números — no necesitamos saber el portal ni el piso.')).toBeDefined()
    })

    it('muestra error bajo el campo Localidad si contiene números', async () => {
        const user = userEvent.setup()
        renderRegisterPage()
        await fillAndSubmit(user, { city: 'León 2' })

        expect(screen.getByText('Este campo solo admite letras. No incluyas números — no necesitamos saber el portal ni el piso.')).toBeDefined()
    })

    it('muestra error bajo el campo Provincia si contiene números', async () => {
        const user = userEvent.setup()
        renderRegisterPage()
        await fillAndSubmit(user, { province: 'León 3' })

        expect(screen.getByText('Este campo solo admite letras. No incluyas números — no necesitamos saber el portal ni el piso.')).toBeDefined()
    })
})