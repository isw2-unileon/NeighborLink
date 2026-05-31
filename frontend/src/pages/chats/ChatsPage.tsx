import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import type { Message } from '../../types';

type Tab = 'owner' | 'borrower';

function ChatCard({ message, currentUserID }: { message: Message; currentUserID: string }) {
    const isMe = message.sender_id === currentUserID;

    return (
        <Link
            to={`/transactions/${message.transaction_id}/chat`}
            className="flex items-center gap-4 rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
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
    const subtitle =
        message.status === 'pending'
            ? '⏳ Pendiente de aceptar y concretar el pago'
            : message.status === 'awaiting_payment'
                ? '💳 Aceptado, pendiente de pago'
                : message.status === 'cancelled'
                    ? '❌ Solicitud rechazada'
                    : '💬 Inicia la conversación para concretar la entrega';

    const subtitleColor =
        message.status === 'pending'
            ? 'text-amber-500'
            : message.status === 'awaiting_payment'
                ? 'text-emerald-600'
                : message.status === 'cancelled'
                    ? 'text-red-500'
                    : 'text-teal-600';

    return (
        <Link
            to={`/transactions/${message.transaction_id}/chat`}
            className="flex items-center gap-4 rounded-3xl border border-dashed border-[var(--accent-2)]/40 bg-white p-4 transition hover:shadow-md"
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

function ChatSection({ chats, currentUserID }: { chats: Message[]; currentUserID: string }) {
    const pending = chats.filter(c => c.status === 'pending');
    const awaitingPayment = chats.filter(c => c.status === 'awaiting_payment');
    const rejected = chats.filter(c => c.status === 'cancelled');
    const activeNoMsg = chats.filter(c => ['agreed', 'handed_over'].includes(c.status ?? '') && c.content === '');
    const activeWithMsg = chats.filter(c => ['agreed', 'handed_over'].includes(c.status ?? '') && c.content !== '');

    if (chats.length === 0) {
        return (
            <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm">No tienes conversaciones en esta categoría.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {pending.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pendientes</h2>
                    {pending.map(msg => <EmptyChatCard key={msg.transaction_id} message={msg} />)}
                </div>
            )}

            {awaitingPayment.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">Pendiente de pago</h2>
                    {awaitingPayment.map(msg => <EmptyChatCard key={msg.transaction_id} message={msg} />)}
                </div>
            )}

            {rejected.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-red-500">Rechazados</h2>
                    {rejected.map(msg => <EmptyChatCard key={msg.transaction_id} message={msg} />)}
                </div>
            )}

            {activeNoMsg.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sin mensajes</h2>
                    {activeNoMsg.map(msg => <EmptyChatCard key={msg.transaction_id} message={msg} />)}
                </div>
            )}

            {activeWithMsg.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Conversaciones</h2>
                    {activeWithMsg.map(msg => <ChatCard key={msg.id} message={msg} currentUserID={currentUserID} />)}
                </div>
            )}
        </div>
    );
}

export default function ChatsPage() {
    const { user } = useAuth();
    const [chats, setChats] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('owner');

    useEffect(() => {
        messagesApi.getActiveChats()
            .then(setChats)
            .catch(() => setError('No se pudieron cargar los chats'))
            .finally(() => setLoading(false));
    }, []);

    if (!user) return null;

    // Pestaña 1: chats donde YO soy el propietario (presto mi objeto)
    const ownerChats = chats.filter(c => c.owner_id === user.id);

    // Pestaña 2: chats donde YO soy el solicitante (quiero alquilar)
    const borrowerChats = chats.filter(c => c.borrower_id === user.id);

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">
            <h1 className="font-editorial text-3xl font-semibold">Mis chats</h1>

            {/* Pestañas */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('owner')}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'owner'
                        ? 'border-b-2 border-teal-600 text-teal-700'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🏠 Presto mi objeto
                    {!loading && ownerChats.length > 0 && (
                        <span className="ml-2 text-xs bg-teal-100 text-teal-700 rounded-full px-1.5 py-0.5">
                            {ownerChats.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('borrower')}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'borrower'
                        ? 'border-b-2 border-teal-600 text-teal-700'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🔍 Quiero alquilar
                    {!loading && borrowerChats.length > 0 && (
                        <span className="ml-2 text-xs bg-teal-100 text-teal-700 rounded-full px-1.5 py-0.5">
                            {borrowerChats.length}
                        </span>
                    )}
                </button>
            </div>

            {loading && (
                <p className="text-sm text-[var(--muted)] text-center py-8">Cargando chats…</p>
            )}
            {error && (
                <p className="text-sm text-red-500 text-center py-8">{error}</p>
            )}

            {!loading && !error && chats.length === 0 && (
                <div className="text-center py-16 text-[var(--muted)]">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="text-sm">No tienes conversaciones activas.</p>
                    <p className="text-xs mt-1">Los chats aparecen cuando haces o recibes una solicitud de préstamo.</p>
                </div>
            )}

            {!loading && !error && chats.length === 0 && (
                <div className="text-center py-16 text-[var(--muted)]">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="text-sm">No tienes conversaciones activas.</p>
                    <p className="text-xs mt-1">Los chats aparecen cuando haces o recibes una solicitud de préstamo.</p>
                </div>
            )}

            {!loading && !error && chats.length > 0 && (
                <ChatSection
                    chats={activeTab === 'owner' ? ownerChats : borrowerChats}
                    currentUserID={user.id}
                />
            )}
        </div>
    );
}