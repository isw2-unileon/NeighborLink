import { api } from './api';
import type { Listing } from '../types';

interface ListingInput {
    title: string;
    description: string;
    photos: string[];
    deposit_amount: number;
    category: string;
    status: string;
}

interface ListingResponse {
    data: Listing;
}

interface ListingsResponse {
    data: Listing[];
}

// Parámetros de filtrado — espejo del backend FilterParams
export interface ListingFilters {
    category?: string;
    deposit?: string;
    status?: string;
    exclude_owner_id?: string;
    lat?: string;
    lon?: string;
    radius_km?: string;
}

export const listingsApi = {
    // El backend devuelve Listing[] directamente (sin wrapper {data})
    getAll: (filters: ListingFilters = {}) => {
        const params = new URLSearchParams();

        (Object.entries(filters) as [string, string | undefined][])
            .forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    params.set(key, value);
                }
            });

        const qs = params.toString();
        return api.get<Listing[]>(`/listings${qs ? `?${qs}` : ''}`);
    },

    // El backend devuelve { data: Listing } en getById, create, update
    getById: (id: string) =>
        api.get<ListingResponse>(`/listings/${id}`).then(r => r.data),

    create: (input: ListingInput) =>
        api.post<ListingResponse>('/listings', input).then(r => r.data),

    update: (id: string, input: ListingInput) =>
        api.put<ListingResponse>(`/listings/${id}`, input).then(r => r.data),

    delete: (id: string) =>
        api.delete(`/listings/${id}`).then(() => undefined),

    uploadPhoto: (id: string, file: File): Promise<Listing> => {
        const formData = new FormData();
        formData.append('photo', file);

        const token = localStorage.getItem('token');

        return fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/listings/${id}/photos`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        }).then(async r => {
            if (!r.ok) {
                const err = await r.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error ?? `HTTP ${r.status}`);
            }

            return r.json().then((d: ListingResponse) => d.data);
        });
    },

    getByOwner: (ownerID: string) =>
        api.get<ListingsResponse>(`/users/${ownerID}/listings`).then(r => r.data),
};