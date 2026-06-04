import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../pages/ProfilePage'
import * as AuthContext from '../contexts/AuthContext'
import * as usersLib from '../lib/users'
import * as listingsLib from '../lib/listings'
import * as walletLib from '../lib/wallet'
import type { User, Listing } from '../types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
    address: 'Calle Mayor 1, León',
    reputation_score: 4,
    points: 0,
    created_at: '2024-01-01',
    lat: 42.5987,
    lon: -5.5671,
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
            <ProfilePage />
        </MemoryRouter>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(listingsLib.listingsApi, 'getByOwner').mockResolvedValue([])
    vi.spyOn(walletLib.walletApi, 'getPointsHistory').mockResolvedValue([])
    vi.spyOn(walletLib.walletApi, 'redeemPoints').mockResolvedValue({
        id: 'r1', user_id: 'user-1', points_redeemed: 1000,
        amount_euros: 10, status: 'pending', created_at: new Date().toISOString(),
    })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfilePage', () => {
    it('no renderiza nada si no hay usuario', () => {
        const { container } = renderPage(null, null)
        expect(container.firstChild).toBeNull()
    })

    it('muestra el nombre y email del usuario', async () => {
        renderPage()
        expect(await screen.findByText('Ana García')).toBeInTheDocument()
        expect(screen.getByText('ana@test.com')).toBeInTheDocument()
    })

    it('muestra la dirección del usuario', async () => {
        renderPage()
        expect(await screen.findByText(/Calle Mayor 1, León/)).toBeInTheDocument()
    })

    it('muestra inicial del nombre si no hay avatar', async () => {
        renderPage()
        expect(await screen.findByText('A')).toBeInTheDocument()
    })

    it('muestra el avatar si existe avatar_url', async () => {
        const userWithAvatar = { ...fakeUser, avatar_url: 'https://example.com/avatar.jpg' }
        renderPage(userWithAvatar)
        const img = await screen.findByAltText('Ana García')
        expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('navega a /profile/edit al pulsar "Editar perfil"', async () => {
        renderPage()
        await screen.findByText('Ana García')
        fireEvent.click(screen.getByText('Editar perfil'))
        expect(mockNavigate).toHaveBeenCalledWith('/profile/edit')
    })

    it('muestra mensaje de error si falla la carga de listings', async () => {
        vi.spyOn(listingsLib.listingsApi, 'getByOwner').mockRejectedValue(new Error('fail'))
        renderPage()
        expect(await screen.findByText('No se pudieron cargar tus objetos')).toBeInTheDocument()
    })

    it('muestra mensaje vacío si no hay listings en un estado', async () => {
        renderPage()
        expect(await screen.findByText('No tienes objetos disponibles.')).toBeInTheDocument()
    })

    it('llama a uploadAvatar y actualiza el usuario al cambiar el avatar', async () => {
        const updatedUser = { ...fakeUser, avatar_url: 'https://new-avatar.com/img.jpg' }
        vi.spyOn(usersLib.usersApi, 'uploadAvatar').mockResolvedValue(updatedUser)
        renderPage()
        await screen.findByText('Ana García')

        const input = document.querySelector('input[type="file"]') as HTMLInputElement
        const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
        fireEvent.change(input, { target: { files: [file] } })

        await waitFor(() => expect(usersLib.usersApi.uploadAvatar).toHaveBeenCalledWith(file))
        expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser)
        expect(await screen.findByText('✓ Avatar actualizado')).toBeInTheDocument()
    })

    it('muestra error si falla la subida del avatar', async () => {
        vi.spyOn(usersLib.usersApi, 'uploadAvatar').mockRejectedValue(new Error('Error de red'))
        renderPage()
        await screen.findByText('Ana García')

        const input = document.querySelector('input[type="file"]') as HTMLInputElement
        const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText('Error de red')).toBeInTheDocument()
    })

    it('muestra los listings del usuario agrupados por estado', async () => {
        const listings: Listing[] = [
            {
                id: 'l1',
                owner_id: 'user-1',
                title: 'Taladro',
                description: '',
                photos: [],
                deposit_amount: 10,
                status: 'available',
                category: 'herramientas',
                created_at: '',
                owner_lat: 42.5987,
                owner_lon: -5.5671,
            },
            {
                id: 'l2',
                owner_id: 'user-1',
                title: 'Bici',
                description: '',
                photos: [],
                deposit_amount: 20,
                status: 'pending_handover',
                category: 'material_deportivo',
                created_at: '',
                owner_lat: 42.5987,
                owner_lon: -5.5671,
            },
        ]
        vi.spyOn(listingsLib.listingsApi, 'getByOwner').mockResolvedValue(listings)
        renderPage()
        expect(await screen.findByText('Taladro')).toBeInTheDocument()
        expect(screen.getByText('Bici')).toBeInTheDocument()
    })

    it('muestra la foto del listing si tiene photos', async () => {
        const listings: Listing[] = [
            {
                id: 'l1',
                owner_id: 'user-1',
                title: 'Taladro',
                description: '',
                photos: ['https://example.com/foto.jpg'],
                deposit_amount: 10,
                status: 'available',
                category: 'herramientas',
                created_at: '',
                owner_lat: 42.5987,
                owner_lon: -5.5671,
            },
        ]
        vi.spyOn(listingsLib.listingsApi, 'getByOwner').mockResolvedValue(listings)
        renderPage()
        const img = await screen.findByAltText('Taladro')
        expect(img).toHaveAttribute('src', 'https://example.com/foto.jpg')
    })
})

describe('ProfilePage — Cartera tab', () => {
    async function openWalletTab(user: User = fakeUser) {
        renderPage(user)
        await screen.findByText('Ana García')
        fireEvent.click(screen.getByText('Cartera'))
    }

    it('muestra la pestaña Cartera al hacer clic', async () => {
        await openWalletTab()
        expect(await screen.findByText('Mi cartera')).toBeInTheDocument()
    })

    it('deshabilita el botón de canjear cuando points < 1000', async () => {
        await openWalletTab({ ...fakeUser, points: 900 })
        const btn = await screen.findByRole('button', { name: /Canjear puntos/i })
        expect(btn).toBeDisabled()
    })

    it('habilita el botón de canjear cuando points >= 1000', async () => {
        await openWalletTab({ ...fakeUser, points: 1000 })
        const btn = await screen.findByRole('button', { name: /Canjear puntos/i })
        expect(btn).not.toBeDisabled()
    })

    it('muestra el balance en puntos y euros', async () => {
        await openWalletTab({ ...fakeUser, points: 1500 })
        expect(await screen.findByText(/15\.00 puntos/)).toBeInTheDocument()
        expect(screen.getByText(/15\.00 €/)).toBeInTheDocument()
    })

    it('muestra mensaje de éxito tras canjear', async () => {
        await openWalletTab({ ...fakeUser, points: 1000 })
        const btn = await screen.findByRole('button', { name: /Canjear puntos/i })
        fireEvent.click(btn)
        expect(await screen.findByText(/Solicitud de cobro enviada/)).toBeInTheDocument()
        expect(mockUpdateUser).toHaveBeenCalledWith(expect.objectContaining({ points: 0 }))
    })
})