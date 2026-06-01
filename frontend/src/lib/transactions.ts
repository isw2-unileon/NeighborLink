import { api } from './api';
import type { Transaction } from '@/types';

export const transactionsApi = {
    getById: (id: string): Promise<Transaction> =>
        api.get<{ data: Transaction }>(`/transactions/${id}`).then(r => r.data),

    pay: (id: string, depositAmountCents: number): Promise<void> =>
        api.put<unknown>(`/transactions/${id}/pay`, { deposit_amount_cents: depositAmountCents })
            .then(() => undefined),
};
