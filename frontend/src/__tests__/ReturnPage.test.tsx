import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ReturnPage from '../pages/ReturnPage'
import { AuthProvider } from '../contexts/AuthContext'
import { api } from '../lib/api'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../lib/api', () => ({
    api: {
        get: vi.fn().mockResolvedValue({
            data: [{ id: 'tx-1', status: 'handed_over', deposit_amount_cents: 500 }]
        }),
        post: vi.fn(),
    }
}))

vi.mock('../lib/users', () => ({
    usersApi: {
        getMe: vi.fn().mockResolvedValue({ id: 'u-1', points: 100 }),
    }
}))

function renderPage() {
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={['/listings/abc/return']}>
                <Routes>
                    <Route path="/listings/:id/return" element={<ReturnPage />} />
                </Routes>
            </MemoryRouter>
        </AuthProvider>
    )
}

beforeEach(() => vi.clearAllMocks())

describe('ReturnPage', () => {
    it('renderiza el formulario de devolución', () => {
        renderPage()
        expect(screen.getByRole('heading', { name: 'Confirmar devolución' })).toBeInTheDocument()
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    it('vuelve a /profile al pulsar ← Volver', () => {
        renderPage()
        fireEvent.click(screen.getByText('← Volver'))
        expect(mockNavigate).toHaveBeenCalledWith('/profile', { state: { tab: 'listings' } })
    })

    it('muestra error con código incorrecto', async () => {
        vi.mocked(api.post).mockRejectedValueOnce(new Error('bad code'))
        renderPage()
        await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
        await waitFor(() =>
            expect(screen.getByText('Código incorrecto o error al confirmar. Inténtalo de nuevo.')).toBeInTheDocument()
        )
    })

    it('limpia el error al cambiar el input', async () => {
        vi.mocked(api.post).mockRejectedValueOnce(new Error('bad code'))
        renderPage()
        await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
        await waitFor(() =>
            expect(screen.getByText('Código incorrecto o error al confirmar. Inténtalo de nuevo.')).toBeInTheDocument()
        )
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '1' } })
        expect(screen.queryByText('Código incorrecto o error al confirmar. Inténtalo de nuevo.')).not.toBeInTheDocument()
    })

    it('muestra éxito y navega con código correcto', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        vi.mocked(api.post).mockResolvedValueOnce({})
        renderPage()
        await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '654321' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
        await waitFor(() =>
            expect(screen.getByText('✓ Acción procesada correctamente. Redirigiendo...')).toBeInTheDocument()
        )
        await vi.runAllTimersAsync()
        expect(mockNavigate).toHaveBeenCalledWith('/profile', { state: { tab: 'listings' } })
        vi.useRealTimers()
    })
})