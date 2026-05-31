import { api } from './api';
import type { Notification } from '../types';

export const notificationsApi = {
    async list(limit = 20): Promise<Notification[]> {
        const res = await api.get<{ data: Notification[] }>(`/notifications?limit=${limit}`);
        return res.data;
    },

    async unreadCount(): Promise<number> {
        const res = await api.get<{ data: { count: number } }>('/notifications/unread-count');
        return res.data.count;
    },

    async markAsRead(id: string): Promise<void> {
        await api.patch(`/notifications/${id}/read`);
    },

    async markAllAsRead(): Promise<void> {
        await api.patch('/notifications/read-all');
    },
};