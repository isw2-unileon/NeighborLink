import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import { listingsApi } from '../../lib/listings';
import type { Message, Listing } from '../../types';
import { api } from '../../lib/api';

const POLL_INTERVAL_MS = 3000;

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMe
                ? 'bg-teal-600 text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                <p>{message.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-teal-200' : 'text-gray-400'}`}>
                    {new Date(message.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit', minute: '2-digit'
                    })}
                </p>
            </div>
        </div>
    );
}

export default function ChatDetailPage() {
    const { id: transactionId } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<Message[]>([]);
    const [listing, setListing] = useState<Listing | null>(null);
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);

    useEffect(() => {
        if (!transactionId) return;
        api.get<{ data: { listing_id: string } }>(`/transactions/${transactionId}`)
            .then(r => listingsApi.getById(r.data.listing_id))
            .then(setListing)
            .catch(() => { });
    }, [transactionId]);

    useEffect(() => {
        if (!transactionId) return;

        const fetchMessages = () =>
            messagesApi.getByTransaction(transactionId)
                .then(msgs => {
                    setMessages(msgs);
                    // Solo scroll automático en la carga inicial
                    if (!initialScrollDone.current) {
                        setTimeout(() => {
                            bottomRef.current?.scrollIntoView({ behavior: 'instant' });
                            initialScrollDone.current = true;
                        }, 50);
                    }
                })
                .catch(() => setError('No se pudieron cargar los mensajes'));

        fetchMessages();
        const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [transactionId]);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!content.trim() || !transactionId) return;

        setSending(true);
        setError(null);
        try {
            const newMsg = await messagesApi.create(transactionId, content.trim());
            setMessages(prev => [...prev, newMsg]);
            setContent('');
            // Scroll al enviar un mensaje propio
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al enviar el mensaje');
        } finally {
            setSending(false);
        }
    }

    if (!user) return null;

    return (
        <div className="max-w-2xl mx-auto flex flex-col fixed inset-x-0 bottom-0" style={{ top: '4rem' }}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-3">
                <button onClick={() => navigate('/chats')}
                    className="text-sm text-gray-500 hover:text-gray-700 mr-1">
                    ←
                </button>
                {listing?.photos?.[0]
                    ? <img src={listing.photos[0]} alt={listing.title}
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
                }
                <div>
                    <h1 className="text-base font-semibold text-gray-900">
                        {listing?.title ?? 'Chat'}
                    </h1>
                    <p className="text-xs text-gray-400">
                        Transacción {transactionId?.slice(0, 8)}…
                    </p>
                </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 bg-gray-50">
                {messages.length === 0 && (
                    <p className="text-sm text-gray-400 text-center mt-8">
                        No hay mensajes aún. ¡Empieza la conversación!
                    </p>
                )}
                {messages.map(msg => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isMe={msg.sender_id === user.id}
                    />
                ))}
                <div ref={bottomRef} />
            </div>

            {error && (
                <p className="text-xs text-red-500 text-center py-1 bg-red-50">{error}</p>
            )}

            {/* Input */}
            <form onSubmit={handleSend}
                className="px-6 py-4 border-t border-gray-200 bg-white flex gap-3 items-center">
                <input
                    type="text"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    disabled={sending}
                />
                <button
                    type="submit"
                    disabled={sending || !content.trim()}
                    className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 transition disabled:opacity-50">
                    {sending ? '…' : 'Enviar'}
                </button>
            </form>
        </div>
    );
}