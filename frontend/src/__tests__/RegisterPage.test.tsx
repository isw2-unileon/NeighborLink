import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import RegisterPage from '../pages/RegisterPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Respuesta de Nominatim que resuelve correctamente lat/lng
const nominatimOk = {
    ok: true,
    json: async () => [{ lat: '42.5987', lon: '-5.5671' }],
}

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

// Rellena el formulario, dispara el blur de dirección (geocodificación)
// y luego hace click en submit.
// mockFetch debe estar ya configurado antes de llamar a este helper.
async function fillAndSubmit(
    user: ReturnType<typeof userEvent.setup>,
    opts: { name?: string; email?: string; password?: string; address?: string } = {}
) {
    await user.type(screen.getByLabelText('Nombre'), opts.name ?? 'Nuevo')
    await user.type(screen.getByLabelText('Email'), opts.email ?? 'nuevo@a.com')
    await user.type(screen.getByLabelText('Contraseña'), opts.password ?? 'password123')
    await user.type(screen.getByLabelText('Dirección'), opts.address ?? 'Calle Mayor 1, León')
    // Disparamos blur para que handleAddressBlur llame a Nominatim
    await user.tab()
    // Esperamos a que desaparezca "Buscando dirección..."
    await waitFor(() => {
        expect(screen.queryByText('Buscando dirección...')).toBeNull()
    })
    await user.click(screen.getByRole('button', { name: 'Registrarse' }))
}

describe('RegisterPage', () => {
    it('renderiza los campos de nombre, email, contraseña y dirección', () => {
        renderRegisterPage()
        expect(screen.getByLabelText('Nombre')).toBeDefined()
        expect(screen.getByLabelText('Email')).toBeDefined()
        expect(screen.getByLabelText('Contraseña')).toBeDefined()
        expect(screen.getByLabelText('Dirección')).toBeDefined()
    })

    it('renderiza el botón de submit', () => {
        renderRegisterPage()
        expect(screen.getByRole('button', { name: 'Registrarse' })).toBeDefined()
    })

    it('redirige a /listings tras registro exitoso', async () => {
        const user = userEvent.setup()
        // 1ª llamada: Nominatim  |  2ª llamada: POST /auth/register
        mockFetch
            .mockResolvedValueOnce(nominatimOk)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token',
                    user: { id: '1', email: 'nuevo@a.com', name: 'Nuevo', avatar_url: '', reputation_score: 0, created_at: '' },
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
        mockFetch
            .mockResolvedValueOnce(nominatimOk)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token',
                    user: { id: '1', email: 'nuevo@a.com', name: 'Nuevo', avatar_url: '', reputation_score: 0, created_at: '' },
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
        mockFetch
            .mockResolvedValueOnce(nominatimOk)
            .mockResolvedValueOnce({
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
        // Nominatim resuelve, el registro se queda colgado
        mockFetch
            .mockResolvedValueOnce(nominatimOk)
            .mockReturnValueOnce(new Promise(() => { }))

        renderRegisterPage()
        await fillAndSubmit(user, { name: 'Mario', email: 'a@a.com' })

        expect(screen.getByText('Cargando…')).toBeDefined()
    })
})