import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HandoverPage from '../pages/HandoverPage'
import { api } from '../lib/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../lib/api', () => ({
    api: {
        get: vi.fn().mockResolvedValue({
            data: [{ id: 'tx-1', status: 'agreed', deposit_amount_cents: 500 }]
        }),
        post: vi.fn(),
    }
}))

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/listings/abc/handover']}>
            <Routes>
                <Route path="/listings/:id/handover" element={<HandoverPage />} />
            </Routes>
        </MemoryRouter>
    )
}

beforeEach(() => vi.clearAllMocks())

describe('HandoverPage', () => {
    it('renderiza el formulario de entrega', () => {
        renderPage()
        expect(screen.getByRole('heading', { name: 'Confirmar entrega' })).toBeInTheDocument()
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
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
        await waitFor(() =>
            expect(screen.getByText('Código incorrecto o error al confirmar. Inténtalo de nuevo.')).toBeInTheDocument()
        )
    })

    it('limpia el error al cambiar el input', async () => {
        vi.mocked(api.post).mockRejectedValueOnce(new Error('bad code'))
        renderPage()
        await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
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
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
        await waitFor(() =>
            expect(screen.getByText('✓ Entrega confirmada correctamente')).toBeInTheDocument()
        )
        await vi.runAllTimersAsync()
        expect(mockNavigate).toHaveBeenCalledWith('/profile', { state: { tab: 'listings' } })
        vi.useRealTimers()
    })
})