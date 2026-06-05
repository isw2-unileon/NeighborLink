import { api } from './api';
import type { Redemption, PointsHistoryEntry } from '../types';

export const walletApi = {
    redeemPoints: (pointsToRedeem: number) =>
        api.post<{ data: Redemption }>('/users/me/redeem-points', { points_to_redeem: pointsToRedeem }).then(r => r.data),
    getPointsHistory: () =>
        api.get<{ data: PointsHistoryEntry[] }>('/users/me/points-history').then(r => r.data),
};