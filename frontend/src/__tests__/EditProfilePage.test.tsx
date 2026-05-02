import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EditProfilePage from '../pages/EditProfilePage'
import * as AuthContext from '../contexts/AuthContext'
import * as usersLib from '../lib/users'
import type { User } from '../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

const fakeUser: User = {
    id: 'user-1',
    name: 'Ana García',
    email: 'ana@test.com',
    avatar_url: '',
    address: 'Calle Mayor, León, León',
    reputation_score: 4,
    created_at: '2024-01-01',
}

const mockUpdateUser = vi.fn()

function renderPage(user: User | null = fakeUser, token: string | null = 'tok') {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user,
        token,
        updateUser: mockUpdateUser,
        login: vi.fn(),
        logout: vi.fn(),
    })
    return render(
        <MemoryRouter>
            <EditProfilePage />
        </MemoryRouter>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('EditProfilePage', () => {
    it('no renderiza nada si no hay usuario', () => {
        const { container } = renderPage(null, null)
        expect(container.firstChild).toBeNull()
    })

    it('rellena el formulario con los datos del usuario', () => {
        renderPage()
        expect(screen.getByLabelText('Nombre')).toHaveValue('Ana García')
        expect(screen.getByLabelText('Calle')).toHaveValue('Calle Mayor')
        expect(screen.getByLabelText('Localidad')).toHaveValue('León')
        expect(screen.getByLabelText('Provincia')).toHaveValue('León')
    })

    it('el email está deshabilitado', () => {
        renderPage()
        expect(screen.getByLabelText('Email')).toBeDisabled()
    })

    it('navega a /profile al pulsar ← Cancelar', () => {
        renderPage()
        fireEvent.click(screen.getByText('← Cancelar'))
        expect(mockNavigate).toHaveBeenCalledWith('/profile')
    })

    it('navega a /profile al pulsar el botón Cancelar', () => {
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(mockNavigate).toHaveBeenCalledWith('/profile')
    })

    it('muestra error si la calle contiene números', async () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle 123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findAllByText('Este campo solo admite letras. No incluyas números.')).toHaveLength(1)
    })

    it('limpia el error del campo al modificarlo', async () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle 123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findAllByText('Este campo solo admite letras. No incluyas números.')).toHaveLength(1)
        fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Nueva' } })
        expect(screen.queryByText('Este campo solo admite letras. No incluyas números.')).not.toBeInTheDocument()
    })

    it('guarda correctamente y navega a /profile', async () => {
        vi.spyOn(usersLib.usersApi, 'updateMe').mockResolvedValue({ ...fakeUser, name: 'Ana López' })
        renderPage()
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana López' } })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/profile'))
        expect(mockUpdateUser).toHaveBeenCalled()
    })

    it('muestra error si falla el guardado', async () => {
        vi.spyOn(usersLib.usersApi, 'updateMe').mockRejectedValue(new Error('Error de red'))
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findByText('Error de red')).toBeInTheDocument()
    })

    it('muestra "Cargando…" en el botón mientras guarda', async () => {
        vi.spyOn(usersLib.usersApi, 'updateMe').mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve(fakeUser), 500))
        )
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findByText('Cargando…')).toBeInTheDocument()
    })
    it('maneja address vacío sin errores', () => {
        const userSinAddress = { ...fakeUser, address: '' }
        renderPage(userSinAddress)
        expect(screen.getByLabelText('Calle')).toHaveValue('')
        expect(screen.getByLabelText('Localidad')).toHaveValue('')
        expect(screen.getByLabelText('Provincia')).toHaveValue('')
    })

    it('muestra error si la localidad contiene números', async () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Localidad'), { target: { value: 'León 2' } })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findAllByText('Este campo solo admite letras. No incluyas números.')).toHaveLength(1)
    })

    it('muestra error si la provincia contiene números', async () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Provincia'), { target: { value: 'León 3' } })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findAllByText('Este campo solo admite letras. No incluyas números.')).toHaveLength(1)
    })

    it('muestra error genérico si el error no es instancia de Error', async () => {
        vi.spyOn(usersLib.usersApi, 'updateMe').mockRejectedValue('error desconocido')
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
        expect(await screen.findByText('Error al guardar')).toBeInTheDocument()
    })
})