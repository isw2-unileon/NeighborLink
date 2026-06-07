// Tipos del dominio — espejo exacto del schema de Supabase/backend
// Fuente de verdad única para todo el frontend (DRY)

export interface User {
    id: string;
    email: string;
    name: string;
    address: string;
    avatar_url: string;
    reputation_score: number;
    points: number;
    role: 'user' | 'admin';
    created_at: string;
    lat: number;
    lon: number;
}

export interface Listing {
    id: string;
    owner_id: string;
    title: string;
    description: string;
    photos: string[];
    deposit_amount: number;
    status: string;
    category: string;
    created_at: string;
    owner_lat: number;
    owner_lon: number;
}

export type TransactionStatus = 'pending' | 'awaiting_payment' | 'agreed' | 'handed_over' | 'returned' | 'cancelled' | 'pending_review';

export interface Transaction {
    id: string;
    listing_id: string;
    borrower_id: string;
    status: TransactionStatus;
    stripe_payment_intent_id?: string;
    payment_method_id?: string;
    payment_method?: 'card' | 'points';
    total_charged_cents: number;
    start_date: string | null;
    end_date: string | null;
    agreed_at: string | null;
    handover_at: string | null;
    return_at: string | null;
    dispute_refund_points?: number;
    listing_title?: string;
    listing_photo?: string;
}

export interface Message {
    id: string;
    transaction_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    status?: string;
    listing_title?: string;
    listing_photo?: string;
    borrower_id?: string;
    owner_id?: string;
}

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    payload: Record<string, unknown>;
    read: boolean;
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

export interface Redemption {
    id: string;
    user_id: string;
    points_redeemed: number;
    amount_euros: number;
    status: string;
    created_at: string;
}

export interface PointsHistoryEntry {
    transaction_id: string;
    listing_title: string;
    points_earned: number;
    completed_at: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}