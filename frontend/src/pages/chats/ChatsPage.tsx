import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import type { Message } from '../../types';

function ChatCard({ message, currentUserID }: { message: Message; currentUserID: string }) {
    const isMe = message.sender_id === currentUserID;

    return (
        <Link
            to={`/transactions/${message.transaction_id}/chat`}
            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-teal-300 hover:shadow-md transition"
        >
            {message.listing_photo
                ? <img src={message.listing_photo} alt={message.listing_title}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-2xl flex-shrink-0">📦</div>
            }
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                    {message.listing_title ?? 'Objeto'}
                </p>
                <p className="text-sm text-gray-500 truncate">
                    {isMe ? 'Tú: ' : ''}{message.content}
                </p>
            </div>
            <p className="text-xs text-gray-400 flex-shrink-0">
                {new Date(message.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short'
                })}
            </p>
        </Link>
    );
}

function EmptyChatCard({ message }: { message: Message }) {
    const subtitle = message.status === 'pending'
        ? '⏳ Pendiente de aceptar y concretar el pago'
        : '💬 Inicia la conversación para concretar la entrega';

    const subtitleColor = message.status === 'pending'
        ? 'text-amber-500'
        : 'text-teal-600';

    return (
        <Link
            to={`/transactions/${message.transaction_id}/chat`}
            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-dashed border-teal-300 hover:border-teal-400 hover:shadow-md transition"
        >
            {message.listing_photo
                ? <img src={message.listing_photo} alt={message.listing_title}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-2xl flex-shrink-0">📦</div>
            }
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                    {message.listing_title ?? 'Objeto'}
                </p>
                <p className={`text-sm truncate ${subtitleColor}`}>
                    {subtitle}
                </p>
            </div>
        </Link>
    );
}

export default function ChatsPage() {
    const { user } = useAuth();
    const [chats, setChats] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        messagesApi.getActiveChats()
            .then(setChats)
            .catch(() => setError('No se pudieron cargar los chats'))
            .finally(() => setLoading(false));
    }, []);

    if (!user) return null;

    const pending = chats.filter(c => c.status === 'pending');
    const awaitingPayment = chats.filter(c => c.status === 'awaiting_payment');
    const activeNoMsg = chats.filter(c => ['agreed', 'handed_over'].includes(c.status ?? '') && c.content === '');
    const activeWithMsg = chats.filter(c => ['agreed', 'handed_over'].includes(c.status ?? '') && c.content !== '');

    return (
        <div className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
            <h1 className="text-xl font-bold text-gray-900">Mis chats</h1>

            {loading && (
                <p className="text-sm text-gray-400 text-center py-8">Cargando chats…</p>
            )}
            {error && (
                <p className="text-sm text-red-500 text-center py-8">{error}</p>
            )}

            {!loading && !error && chats.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="text-sm">No tienes conversaciones activas.</p>
                    <p className="text-xs mt-1">Los chats aparecen cuando haces o recibes una solicitud de préstamo.</p>
                </div>
            )}

            {!loading && !error && pending.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pendientes</h2>
                    {pending.map(msg => (
                        <EmptyChatCard key={msg.transaction_id} message={msg} />
                    ))}
                </div>
            )}

            {!loading && !error && awaitingPayment.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">Pendiente de pago</h2>
                    {awaitingPayment.map(msg => (
                        <EmptyChatCard key={msg.transaction_id} message={msg} />
                    ))}
                </div>
            )}

            {!loading && !error && activeNoMsg.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sin mensajes</h2>
                    {activeNoMsg.map(msg => (
                        <EmptyChatCard key={msg.transaction_id} message={msg} />
                    ))}
                </div>
            )}

            {!loading && !error && activeWithMsg.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Conversaciones</h2>
                    {activeWithMsg.map(msg => (
                        <ChatCard key={msg.id} message={msg} currentUserID={user.id} />
                    ))}
                </div>
            )}
        </div>
    );
}