import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ListingsPage from '../pages/listings/ListingsPage'
import * as AuthContext from '../contexts/AuthContext'
import * as listingsLib from '../lib/listings'
import type { Listing, User } from '../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

const fakeListing: Listing = {
    id: 'l1', owner_id: 'u1', title: 'Taladro',
    description: 'Un taladro en buen estado', photos: [],
    deposit_amount: 20, status: 'available', created_at: '',
}

const fakeListingWithPhoto: Listing = { ...fakeListing, id: 'l2', photos: ['http://img.test/foto.jpg'] }

function renderPage(user: User | null = null) {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user, token: null, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn(),
    })
    return render(<MemoryRouter><ListingsPage /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('ListingsPage', () => {
    it('muestra el estado de carga inicial', () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockReturnValue(new Promise(() => { }))
        renderPage()
        expect(screen.getByText('Cargando artículos...')).toBeInTheDocument()
    })

    it('muestra error si falla la carga', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockRejectedValue(new Error('Error de red'))
        renderPage()
        expect(await screen.findByText('Error: Error de red')).toBeInTheDocument()
    })

    it('muestra mensaje cuando no hay artículos', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([])
        renderPage()
        expect(await screen.findByText('No hay artículos disponibles todavía.')).toBeInTheDocument()
    })

    it('renderiza los listings cuando la carga es exitosa', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([fakeListing])
        renderPage()
        expect(await screen.findByText('Taladro')).toBeInTheDocument()
        expect(screen.getByText('20 € depósito')).toBeInTheDocument()
    })

    it('renderiza la foto del listing si tiene photos', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([fakeListingWithPhoto])
        renderPage()
        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img.test/foto.jpg'))
    })

    it('no muestra el botón Publicar si no hay usuario', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([])
        renderPage(null)
        await screen.findByText('No hay artículos disponibles todavía.')
        expect(screen.queryByText('+ Publicar artículo')).not.toBeInTheDocument()
    })

    it('muestra el botón Publicar si hay usuario autenticado', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([])
        renderPage({ id: 'u1', name: 'Ana' } as User)
        expect(await screen.findByText('+ Publicar artículo')).toBeInTheDocument()
    })

    it('navega a /listings/new al pulsar Publicar artículo', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([])
        renderPage({ id: 'u1', name: 'Ana' } as User)
        fireEvent.click(await screen.findByText('+ Publicar artículo'))
        expect(mockNavigate).toHaveBeenCalledWith('/listings/new')
    })

    it('el link de un listing apunta a /listings/:id', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([fakeListing])
        renderPage()
        const link = await screen.findByRole('link', { name: /Taladro/i })
        expect(link).toHaveAttribute('href', '/listings/l1')
    })

    //filtros
    it('aplica el filtro de categoría y recarga listings', async () => {
        const getAllMock = vi
            .spyOn(listingsLib.listingsApi, 'getAll')
            .mockResolvedValue([])

        renderPage()

        // Esperar a que termine el loading inicial
        await screen.findByText('Explorar artículos')

        const selects = screen.getAllByRole('combobox')
        const categorySelect = selects[0]

        fireEvent.change(categorySelect, { target: { value: 'herramientas' } })

        await waitFor(() => {
            expect(getAllMock).toHaveBeenLastCalledWith(
                expect.objectContaining({ category: 'herramientas' })
            )
        })
    })


    it('aplica el filtro de estado y recarga listings', async () => {
        const getAllMock = vi
            .spyOn(listingsLib.listingsApi, 'getAll')
            .mockResolvedValue([])

        renderPage()

        // Esperar a que termine el loading inicial
        await screen.findByText('Explorar artículos')

        const selects = screen.getAllByRole('combobox')
        const statusSelect = selects[1]

        fireEvent.change(statusSelect, { target: { value: 'available' } })

        await waitFor(() => {
            expect(getAllMock).toHaveBeenLastCalledWith(
                expect.objectContaining({ status: 'available' })
            )
        })
    })

    it('filtra por texto en cliente usando el buscador', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getAll').mockResolvedValue([
            { ...fakeListing, id: '1', title: 'Taladro', description: 'Potente' },
            { ...fakeListing, id: '2', title: 'Bicicleta', description: 'Montaña' },
        ])

        renderPage()

        expect(await screen.findByText('Taladro')).toBeInTheDocument()
        expect(screen.getByText('Bicicleta')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('Nombre del artículo...'), {
            target: { value: 'bici' },
        })

        expect(screen.queryByText('Taladro')).not.toBeInTheDocument()
        expect(screen.getByText('Bicicleta')).toBeInTheDocument()
    })
})