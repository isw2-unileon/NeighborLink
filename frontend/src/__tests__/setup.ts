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