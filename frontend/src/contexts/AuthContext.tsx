import { createContext, useContext, useState, ReactNode } from 'react';

import type { User } from '../types';


// Forma del contexto — lo que exponemos globalmente
interface AuthContextValue {
    token: string | null;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    updateUser: (user: User) => void;
}

// Creamos el contexto con valor inicial undefined
// Usamos undefined para detectar si alguien lo consume fuera del Provider
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Hook personalizado — encapsula el useContext y lanza error si se usa mal
// Patrón: Custom Hook sobre Context (evita importar AuthContext directamente)
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

// Provider — envuelve la app y comparte estado global de autenticación
export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem('token') // Hidratamos desde localStorage al iniciar
    );
    const [user, setUser] = useState<User | null>(
        () => {
            const raw = localStorage.getItem('user');
            return raw ? (JSON.parse(raw) as User) : null;
        }
    );

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

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}