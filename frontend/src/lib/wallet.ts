import { api } from './api';
import type { Redemption, PointsHistoryEntry } from '../types';

export const walletApi = {
    redeemPoints: () =>
        api.post<{ data: Redemption }>('/users/me/redeem-points', {}).then(r => r.data),
    getPointsHistory: () =>
        api.get<{ data: PointsHistoryEntry[] }>('/users/me/points-history').then(r => r.data),
};