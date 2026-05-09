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
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold flex-shrink-0">
                💬
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">
                    Transacción {message.transaction_id.slice(0, 8)}…
                </p>
                <p className="text-sm text-gray-700 truncate">
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
                    <p className="text-xs mt-1">Los chats aparecen cuando tienes un préstamo en curso.</p>
                </div>
            )}
            {!loading && !error && chats.map(msg => (
                <ChatCard key={msg.id} message={msg} currentUserID={user.id} />
            ))}
        </div>
    );
}