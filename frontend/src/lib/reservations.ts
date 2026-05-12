import { api } from './api';

export interface DateRange {
    start_date: string;
    end_date: string;
}

export interface ReserveInput {
    start_date: string;
    end_date: string;
    payment_method_id: string;
}

interface AvailabilityResponse {
    data: DateRange[];
}

interface ReserveResponse {
    data: { id: string };
}

export const reservationsApi = {
    getAvailability: (listingId: string) =>
        api.get<AvailabilityResponse>(`/listings/${listingId}/availability`).then(r => r.data),

    reserve: (listingId: string, input: ReserveInput) =>
        api.post<ReserveResponse>(`/listings/${listingId}/reserve`, input).then(r => r.data),
};