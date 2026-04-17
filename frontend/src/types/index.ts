// Tipos del dominio — espejo exacto del schema de Supabase/backend
// Fuente de verdad única para todo el frontend (DRY)

export interface User {
    id: string;
    email: string;
    name: string;
    avatar_url: string;
    reputation_score: number;
    created_at: string;
}

export interface Listing {
    id: string;
    owner_id: string;
    title: string;
    description: string;
    photos: string;
    deposit_amount: number;
    status: string;
    created_at: string;
}

export type TransactionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';

export interface Transaction {
    id: string;
    listing_id: string;
    borrower_id: string;
    status: TransactionStatus;
    agreed_at: string | null;
    handover_at: string | null;
    return_at: string | null;
}

export interface Message {
    id: string;
    transaction_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

export interface Review {
    id: string;
    transaction_id: string;
    reviewer_id: string;
    reviewed_id: string;
    rating: number;
    comment: string;
    created_at: string;
}