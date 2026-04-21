import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Input from '../components/ui/Input'

describe('Input', () => {
    it('renderiza el label y el input asociados correctamente', () => {
        render(<Input label="Email" />)
        expect(screen.getByLabelText('Email')).toBeDefined()
    })

    it('muestra el mensaje de error cuando se pasa la prop error', () => {
        render(<Input label="Email" error="El email no es válido" />)
        expect(screen.getByText('El email no es válido')).toBeDefined()
    })

    it('no muestra mensaje de error cuando no se pasa la prop error', () => {
        render(<Input label="Email" />)
        expect(screen.queryByRole('alert')).toBeNull()
    })

    it('aplica clase de error al input cuando hay error', () => {
        render(<Input label="Email" error="Error" />)
        const input = screen.getByLabelText('Email')
        expect((input as HTMLInputElement).className).toContain('border-red-400')
    })

    it('pasa props nativas al input (placeholder, type, value)', () => {
        render(<Input label="Contraseña" type="password" placeholder="Min 6 chars" />)
        const input = screen.getByLabelText('Contraseña') as HTMLInputElement
        expect(input.type).toBe('password')
        expect(input.placeholder).toBe('Min 6 chars')
    })

    it('llama a onChange cuando el usuario escribe', async () => {
        const user = userEvent.setup()
        let valor = ''
        render(<Input label="Nombre" onChange={e => { valor = e.target.value }} />)
        await user.type(screen.getByLabelText('Nombre'), 'Mario')
        expect(valor).toBe('Mario')
    })
})