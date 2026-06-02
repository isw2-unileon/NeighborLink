import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Limpia el DOM entre cada test — evita el "Found multiple elements"
afterEach(() => {
    cleanup()
})

// Mock completo de localStorage (necesario porque happy-dom/jsdom no lo implementan del todo)
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} },
    }
})()

vi.stubGlobal('localStorage', localStorageMock)

// Resetea el store antes de cada test — evita contaminación entre tests
beforeEach(() => {
    localStorageMock.clear()
})

// Mock de IntersectionObserver — jsdom no lo implementa
vi.stubGlobal('IntersectionObserver', class {
    observe() { }
    unobserve() { }
    disconnect() { }
})

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock de Stripe
vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn().mockResolvedValue({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => children,
    CardNumberElement: () => null,
    CardExpiryElement: () => null,
    CardCvcElement: () => null,
    useStripe: () => ({
        createPaymentMethod: vi.fn().mockResolvedValue({ paymentMethod: { id: 'pm_123' } }),
    }),
    useElements: () => ({
        getElement: vi.fn(),
    }),
}));