// Facade de la API de usuarios — mismo patrón que listings.ts
// DRY: centraliza todas las llamadas al módulo /users en un único lugar

import { api } from './api';
import type { User } from '../types';

interface UpdateMeInput {
    name: string;
    address: string;
}

interface ApiResponse<T> {
    data: T;
}

export const usersApi = {
    getUser: (id: string) =>
        api.get<ApiResponse<User>>(`/users/${id}`).then(r => r.data),

    updateMe: (input: UpdateMeInput) =>
        api.put<ApiResponse<User>>('/users/me', input).then(r => r.data),

    uploadAvatar: async (file: File): Promise<User> => {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch(
            `${import.meta.env.VITE_API_URL ?? '/api'}/users/me/avatar`,
            {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            }
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error ?? `HTTP ${response.status}`);
        }

        const json = await response.json() as ApiResponse<User>;
        return json.data;
    },
};