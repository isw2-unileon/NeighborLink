import { api } from './api';
import type { Transaction } from '@/types';

export const transactionsApi = {
    getById: (id: string): Promise<Transaction> =>
        api.get<{ data: Transaction }>(`/transactions/${id}`).then(r => r.data),

    pay: (id: string, depositAmountCents: number, paymentMethodId: string): Promise<void> =>
        api.put<unknown>(`/transactions/${id}/pay`, {
            deposit_amount_cents: depositAmountCents,
            payment_method_id: paymentMethodId
        })
            .then(() => undefined),

    reportIssue: (id: string): Promise<void> =>
        api.post<unknown>(`/transactions/${id}/report-issue`, {})
            .then(() => undefined),

    resolveDispute: (id: string): Promise<void> =>
        api.post<unknown>(`/transactions/${id}/resolve-dispute`, {})
            .then(() => undefined),

    refundDisputePoints: (id: string, percentage: number): Promise<void> =>
        api.post<unknown>(`/transactions/${id}/refund-dispute`, { percentage })
            .then(() => undefined),
};
