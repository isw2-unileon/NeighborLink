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
        api.delete<void>(`/listings/${id}`),
};