import { api } from './api';
import type { Listing } from '../types';

interface ListingInput {
    title: string;
    description: string;
    photos: string[];
    deposit_amount: number;
}

interface ListingsResponse {
    data: Listing[];
}

interface ListingResponse {
    data: Listing;
}

export const listingsApi = {
    getAll: () =>
        api.get<ListingsResponse>('/listings').then(r => r.data),

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
            return r.json().then((d: { data: Listing }) => d.data);
        });
    },
    getByOwner: (ownerID: string) =>
        api.get<ListingsResponse>(`/users/${ownerID}/listings`).then(r => r.data),
};