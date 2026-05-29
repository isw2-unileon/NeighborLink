import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import { listingsApi } from '../../lib/listings';
import type { Message, Listing } from '../../types';
import { api } from '../../lib/api';

const POLL_INTERVAL_MS = 3000;

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
    const isSystem = message.sender_id === '00000000-0000-0000-0000-000000000000';

    if (isSystem) {
        return (
            <div className="flex justify-center">
                <div className="max-w-md px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
                    <p>{message.content}</p>
                </div>
            </div>
        );
    }

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

function EleccionModal({
    onClose,
    onAccept,
    onReject,
    loading
}: {
    onClose: () => void;
    onAccept: () => void;
    onReject: () => void;
    loading: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5">
                <div>
                    <h2 className="text-base font-bold text-gray-900 mb-1">Tomar una decisión</h2>
                    <p className="text-sm text-gray-500">
                        ¿Deseas aceptar o rechazar esta solicitud?
                    </p>
                </div>

                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <span className="text-amber-500 text-base mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        Esta decisión no se podrá deshacer después.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onAccept}
                        disabled={loading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                    >
                        Aceptar
                    </button>
                    <button
                        onClick={onReject}
                        disabled={loading}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                    >
                        Rechazar
                    </button>
                </div>

                <button
                    onClick={onClose}
                    disabled={loading}
                    className="text-xs text-gray-400 hover:text-gray-600 text-center transition"
                >
                    Cancelar
                </button>
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

    const [transactionStatus, setTransactionStatus] = useState<string | null>(null);
    const [showEleccion, setShowEleccion] = useState(false);
    const [decisionLoading, setDecisionLoading] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);

    useEffect(() => {
        if (!transactionId) return;
        api.get<{ data: { listing_id: string; status: string } }>(`/transactions/${transactionId}`)
            .then(r => {
                setTransactionStatus(r.data.status);
                return listingsApi.getById(r.data.listing_id);
            })
            .then(setListing)
            .catch(() => { });
    }, [transactionId]);

    useEffect(() => {
        if (!transactionId) return;

        const fetchMessages = () =>
            messagesApi.getByTransaction(transactionId)
                .then(msgs => {
                    setMessages(msgs);
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
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al enviar el mensaje');
        } finally {
            setSending(false);
        }
    }

    async function handleDecision(decision: 'accept' | 'reject') {
        if (!transactionId) return;

        setShowEleccion(false);
        setDecisionLoading(true);
        setError(null);

        try {
            await api.post(`/transactions/${transactionId}/decision`, { decision });

            if (decision === 'accept') {
                setTransactionStatus('awaiting_payment');
                setMessages(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        transaction_id: transactionId,
                        sender_id: '00000000-0000-0000-0000-000000000000',
                        content: 'El prestador ha aceptado las condiciones propuestas, ahora mete los métodos de pago.',
                        created_at: new Date().toISOString(),
                    },
                ]);
            } else {
                setTransactionStatus('cancelled');
                setMessages(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        transaction_id: transactionId,
                        sender_id: '00000000-0000-0000-0000-000000000000',
                        content: 'El prestador no ha aceptado las condiciones.',
                        created_at: new Date().toISOString(),
                    },
                ]);
            }
        } catch {
            setError('No se pudo guardar la decisión');
        } finally {
            setDecisionLoading(false);
        }
    }

    if (!user) return null;
    const isOwner = listing?.owner_id === user.id;

    return (
        <>
            {showEleccion && (
                <EleccionModal
                    onClose={() => setShowEleccion(false)}
                    onAccept={() => handleDecision('accept')}
                    onReject={() => handleDecision('reject')}
                    loading={decisionLoading}
                />
            )}

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
                    <div className="flex-1">
                        <h1 className="text-base font-semibold text-gray-900">
                            {listing?.title ?? 'Chat'}
                        </h1>
                        <p className="text-xs text-gray-400">
                            Transacción {transactionId?.slice(0, 8)}…
                        </p>
                    </div>

                    {isOwner && transactionStatus === 'pending' && (
                        <button
                            onClick={() => setShowEleccion(true)}
                            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                        >
                            Elección
                        </button>
                    )}

                    {transactionStatus === 'awaiting_payment' && (
                        <div className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-bold px-3 py-2 rounded-lg border border-green-300">
                            ACEPTADO
                        </div>
                    )}

                    {transactionStatus === 'cancelled' && (
                        <div className="flex-shrink-0 bg-red-100 text-red-700 text-xs font-bold px-3 py-2 rounded-lg border border-red-300">
                            DENEGADO
                        </div>
                    )}

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
        </>
    );
}