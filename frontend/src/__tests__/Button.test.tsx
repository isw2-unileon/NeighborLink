import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../components/ui/Button'

describe('Button', () => {
    it('renderiza el texto hijo correctamente', () => {
        render(<Button>Registrarse</Button>)
        expect(screen.getByText('Registrarse')).toBeDefined()
    })

    it('muestra "Cargando…" cuando loading es true', () => {
        render(<Button loading>Registrarse</Button>)
        expect(screen.getByText('Cargando…')).toBeDefined()
        expect(screen.queryByText('Registrarse')).toBeNull()
    })

    it('está deshabilitado cuando loading es true', () => {
        render(<Button loading>Registrarse</Button>)
        expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('está deshabilitado cuando se pasa disabled', () => {
        render(<Button disabled>Registrarse</Button>)
        expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('llama a onClick cuando no está deshabilitado', async () => {
        const user = userEvent.setup()
        let clicked = false
        render(<Button onClick={() => { clicked = true }}>Click</Button>)
        await user.click(screen.getByRole('button'))
        expect(clicked).toBe(true)
    })

    it('no llama a onClick cuando está deshabilitado', async () => {
        const user = userEvent.setup()
        let clicked = false
        render(<Button disabled onClick={() => { clicked = true }}>Click</Button>)
        await user.click(screen.getByRole('button'))
        expect(clicked).toBe(false)
    })

    it('aplica clases de variante primary por defecto', () => {
        render(<Button>Primary</Button>)
        expect((screen.getByRole('button') as HTMLButtonElement).className).toContain('bg-teal-700')
    })

    it('aplica clases de variante ghost cuando se indica', () => {
        render(<Button variant="ghost">Ghost</Button>)
        expect((screen.getByRole('button') as HTMLButtonElement).className).toContain('border-gray-300')
    })
})