import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ReturnPage from '../pages/ReturnPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/listings/abc/return']}>
            <Routes>
                <Route path="/listings/:id/return" element={<ReturnPage />} />
            </Routes>
        </MemoryRouter>
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
        expect(mockNavigate).toHaveBeenCalledWith('/profile')
    })

    it('muestra error con código incorrecto', () => {
        renderPage()
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
        expect(screen.getByText('Código incorrecto. Inténtalo de nuevo.')).toBeInTheDocument()
    })

    it('limpia el error al cambiar el input', () => {
        renderPage()
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
        expect(screen.getByText('Código incorrecto. Inténtalo de nuevo.')).toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '1' } })
        expect(screen.queryByText('Código incorrecto. Inténtalo de nuevo.')).not.toBeInTheDocument()
    })

    it('muestra éxito y navega con código correcto', async () => {
        vi.useFakeTimers()
        renderPage()
        fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '654321' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
        expect(screen.getByText('✓ Devolución confirmada correctamente')).toBeInTheDocument()
        await vi.runAllTimersAsync()
        expect(mockNavigate).toHaveBeenCalledWith('/profile')
        vi.useRealTimers()
    })
})