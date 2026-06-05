import { api } from './api';
import type { Message } from '../types';

interface MessageResponse {
    data: Message;
}

interface MessagesResponse {
    data: Message[];
}

export const messagesApi = {
    getByTransaction: (transactionId: string, signal?: AbortSignal) =>
        api.get<MessagesResponse>(`/transactions/${transactionId}/messages`, { signal }).then(r => r.data),

    getById: (id: string) =>
        api.get<MessageResponse>(`/messages/${id}`).then(r => r.data),

    create: (transactionId: string, content: string) =>
        api.post<MessageResponse>(`/transactions/${transactionId}/messages`, { content }).then(r => r.data),

    getActiveChats: (signal?: AbortSignal) =>
        api.get<MessagesResponse>('/chats', { signal }).then(r => r.data),
};