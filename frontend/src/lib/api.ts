// Cliente HTTP centralizado — único punto de contacto con el backend
// Patrón: Facade — oculta los detalles de fetch y gestión de headers
// SOLID DIP: los componentes dependen de esta abstracción, no de fetch directamente

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// Recupera el token del localStorage en cada petición (no en módulo init)
// para siempre tener el valor más reciente tras login/logout
function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error ?? `HTTP ${response.status}`);
    }

    // 204 No Content — no hay body que parsear
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

// Métodos públicos tipados — la fachada que usan los componentes
export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};