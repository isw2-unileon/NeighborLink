≤import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import PrivateRoute from '../components/PrivateRoute'

// Helper que monta PrivateRoute dentro del contexto y router necesarios
function renderWithAuth(token: string | null) {
    if (token) {
        localStorage.setItem('token', token)
    } else {
        localStorage.removeItem('token')
    }

    return render(
        <MemoryRouter initialEntries={['/profile']}>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<p>Página de login</p>} />
                    <Route element={<PrivateRoute />}>
                        <Route path="/profile" element={<p>Contenido protegido</p>} />
                    </Route>
                </Routes>
            </AuthProvider>
        </MemoryRouter>
    )
}

describe('PrivateRoute', () => {
    it('renderiza el contenido protegido cuando hay token', () => {
        renderWithAuth('valid-token')
        expect(screen.getByText('Contenido protegido')).toBeDefined()
    })

    it('redirige a /login cuando no hay token', () => {
        renderWithAuth(null)
        expect(screen.getByText('Página de login')).toBeDefined()
    })
})