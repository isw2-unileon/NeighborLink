import { useState, useEffect, ReactNode, useContext } from 'react';
import type { User } from '../types';
import { AuthContext, AuthContextValue } from './AuthContextInternal';
import { usersApi } from '../lib/users';

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem('token')
    );
    const [user, setUser] = useState<User | null>(
        () => {
            const raw = localStorage.getItem('user');
            return raw ? (JSON.parse(raw) as User) : null;
        }
    );

    // Escucha el evento de logout forzado desde api.ts (token expirado/inválido)
    useEffect(() => {
        const handleForceLogout = () => {
            setToken(null);
            setUser(null);
            window.location.href = '/login';
        };
        const handleRefresh = () => {
            refreshUser();
        };
        window.addEventListener('auth:logout', handleForceLogout);
        window.addEventListener('auth:refresh', handleRefresh);
        return () => {
            window.removeEventListener('auth:logout', handleForceLogout);
            window.removeEventListener('auth:refresh', handleRefresh);
        };
    }, [token]);

    function login(newToken: string, newUser: User) {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    function updateUser(updated: User) {
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
    }

    async function refreshUser() {
        if (!token) return;
        try {
            const latestUser = await usersApi.getMe();
            updateUser(latestUser);
        } catch (err) {
            console.error('Failed to refresh user data:', err);
        }
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ token, user, login, logout, updateUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}
