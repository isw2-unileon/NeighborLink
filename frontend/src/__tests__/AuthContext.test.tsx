import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import type { User } from '../types'

const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: '',
    reputation_score: 0,
    created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
    localStorage.clear()
})

describe('AuthContext', () => {
    it('empieza sin token ni usuario si localStorage está vacío', () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

        expect(result.current.token).toBeNull()
        expect(result.current.user).toBeNull()
    })

    it('login guarda token y usuario en estado y en localStorage', () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

        act(() => {
            result.current.login('my-token', mockUser)
        })

        expect(result.current.token).toBe('my-token')
        expect(result.current.user).toEqual(mockUser)
        expect(localStorage.getItem('token')).toBe('my-token')
        expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser)
    })

    it('logout limpia el estado y localStorage', () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

        act(() => result.current.login('my-token', mockUser))
        act(() => result.current.logout())

        expect(result.current.token).toBeNull()
        expect(result.current.user).toBeNull()
        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
    })

    it('hidrata el estado desde localStorage al montar', () => {
        localStorage.setItem('token', 'persisted-token')
        localStorage.setItem('user', JSON.stringify(mockUser))

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

        expect(result.current.token).toBe('persisted-token')
        expect(result.current.user).toEqual(mockUser)
    })

    it('useAuth fuera del Provider lanza error', () => {
        expect(() => renderHook(() => useAuth())).toThrow(
            'useAuth must be used within AuthProvider'
        )
    })
})