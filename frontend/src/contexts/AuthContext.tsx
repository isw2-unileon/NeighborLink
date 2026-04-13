import { createContext, useContext, useState, ReactNode } from 'react';

// Tipos que representa el usuario actual
interface User {
    id: string;
    email: string;
    name: string;
}

// Forma del contexto — lo que exponemos globalmente
interface AuthContextValue {
    token: string | null;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
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

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ token, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}