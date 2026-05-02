import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage'

function renderPage() {
    return render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage', () => {
    it('renderiza el titular principal', () => {
        renderPage()
        expect(screen.getByText(/Lo que necesitas ya existe/i)).toBeInTheDocument()
    })

    it('renderiza el enlace Empieza gratis apuntando a /register', () => {
        renderPage()
        const link = screen.getByRole('link', { name: 'Empieza gratis' })
        expect(link).toHaveAttribute('href', '/register')
    })

    it('renderiza el enlace Iniciar sesión apuntando a /login', () => {
        renderPage()
        const link = screen.getByRole('link', { name: 'Iniciar sesión' })
        expect(link).toHaveAttribute('href', '/login')
    })

    it('renderiza la sección ¿Por qué NeighborLink?', () => {
        renderPage()
        expect(screen.getByText('¿Por qué NeighborLink?')).toBeInTheDocument()
    })

    it('renderiza las tres tarjetas de beneficios', () => {
        renderPage()
        expect(screen.getByText('Frena el consumismo')).toBeInTheDocument()
        expect(screen.getByText('Ahorra dinero')).toBeInTheDocument()
        expect(screen.getByText('Construye comunidad')).toBeInTheDocument()
    })

    it('renderiza los tres pasos de cómo funciona', () => {
        renderPage()
        expect(screen.getByText('Regístrate')).toBeInTheDocument()
        expect(screen.getByText('Explora o publica')).toBeInTheDocument()
        expect(screen.getByText('Conéctate')).toBeInTheDocument()
    })

    it('renderiza el CTA final con enlace a /register', () => {
        renderPage()
        expect(screen.getByRole('link', { name: 'Unirme ahora' })).toHaveAttribute('href', '/register')
    })
})