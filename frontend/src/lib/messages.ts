import { api } from './api';
import type { Message } from '../types';

interface MessageResponse {
    data: Message;
}

interface MessagesResponse {
    data: Message[];
}

export const messagesApi = {
    getByTransaction: (transactionId: string) =>
        api.get<MessagesResponse>(`/transactions/${transactionId}/messages`).then(r => r.data),

    getById: (id: string) =>
        api.get<MessageResponse>(`/messages/${id}`).then(r => r.data),

    create: (transactionId: string, content: string) =>
        api.post<MessageResponse>(`/transactions/${transactionId}/messages`, { content }).then(r => r.data),

    getActiveChats: () =>
        api.get<MessagesResponse>('/chats').then(r => r.data),
};