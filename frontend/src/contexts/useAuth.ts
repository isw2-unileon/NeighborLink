import { useContext } from 'react';
import { AuthContext, AuthContextValue } from './AuthContextInternal';

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
