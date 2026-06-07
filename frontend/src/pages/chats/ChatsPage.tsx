import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    CreditCard,
    Clock,
    Home,
    MessageCircle,
    MessageSquareText,
    Package,
    Scale,
    Search,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import type { Message } from '../../types';

type Tab = 'owner' | 'borrower';

const ACTIVE_STATUSES = ['agreed', 'handed_over', 'returned'];

const STATUS_META = {
    pending: {
        text: 'Pendiente de aceptar y concretar el pago',
        tone: 'text-[var(--warning)]',
        Icon: Clock,
    },
    awaiting_payment: {
        text: 'Aceptado, pendiente de pago',
        tone: 'text-[var(--success)]',
        Icon: CreditCard,
    },
    cancelled: {
        text: 'Solicitud rechazada',
        tone: 'text-[var(--danger)]',
        Icon: XCircle,
    },
    pending_review: {
        text: 'En revisión por un administrador',
        tone: 'text-[var(--danger)]',
        Icon: Scale,
    },
    default: {
        text: 'Inicia la conversación para concretar la entrega',
        tone: 'text-[var(--accent)]',
        Icon: MessageSquareText,
    },
} as const;

const sortByDateDesc = (a: Message, b: Message) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

function ChatCard({ message, currentUserID }: { message: Message; currentUserID: string }) {
    const isMe = message.sender_id === currentUserID;

    return (
        <Link
            to={`/transactions/${message.transaction_id}/chat`}
            className="relative flex items-center gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
            {message.has_unread && (
                <span className="absolute top-3 right-3 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
            )}
            {message.listing_photo ? (
                <img
                    src={message.listing_photo}
                    alt={message.listing_title}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
            ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-strong)] flex items-center justify-center text-[var(--muted)] flex-shrink-0">
                    <Package className="w-6 h-6" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] truncate">
                    {message.listing_title ?? 'Objeto'}
                </p>
                <p className="text-sm text-[var(--muted)] truncate">
                    {isMe ? 'Tú: ' : ''}{message.content}
                </p>
            </div>
            <p className="text-xs text-[var(--muted)] flex-shrink-0">
                {new Date(message.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                })}
            </p>
        </Link>
    );
}

function TransactionStatusCard({ message }: { message: Message }) {
    const meta = STATUS_META[message.status as keyof typeof STATUS_META] ?? STATUS_META.default;
    const Icon = meta.Icon;

    return (
        <Link
            to={`/transactions/${message.transaction_id}/chat`}
            className="flex items-center gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 transition hover:shadow-md"
        >
            {message.listing_photo ? (
                <img
                    src={message.listing_photo}
                    alt={message.listing_title}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
            ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-strong)] flex items-center justify-center text-[var(--muted)] flex-shrink-0">
                    <Package className="w-6 h-6" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] truncate">
                    {message.listing_title ?? 'Objeto'}
                </p>
                <p className={`text-sm truncate inline-flex items-center gap-1.5 ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                    {meta.text}
                </p>
            </div>
        </Link>
    );
}

function ChatCardSkeleton() {
    return (
        <div className="flex items-center gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="h-12 w-12 rounded-xl bg-[var(--surface-strong)] animate-pulse" />
            <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-40 rounded-full bg-[var(--surface-strong)] animate-pulse" />
                <div className="h-3 w-56 rounded-full bg-[var(--surface-strong)] animate-pulse" />
            </div>
            <div className="h-3 w-12 rounded-full bg-[var(--surface-strong)] animate-pulse" />
        </div>
    );
}

function ChatListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: count }).map((_, index) => (
                <ChatCardSkeleton key={`chat-skeleton-${index}`} />
            ))}
        </div>
    );
}

function ChatList({ chats, currentUserID }: { chats: Message[]; currentUserID: string }) {
    if (chats.length === 0) {
        return (
            <div className="text-center py-16 text-[var(--muted)]">
                <MessageCircle className="h-10 w-10 mx-auto mb-3 text-[var(--accent-3)]" />
                <p className="text-sm">No tienes conversaciones en esta categoría.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {chats.map((msg) => {
                const isActive = ACTIVE_STATUSES.includes(msg.status ?? '');
                const hasContent = msg.content !== '';
                if (hasContent && (isActive || msg.status === 'pending_review')) {
                    return <ChatCard key={msg.id} message={msg} currentUserID={currentUserID} />;
                }
                return <TransactionStatusCard key={msg.transaction_id} message={msg} />;
            })}
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
        const controller = new AbortController();

        messagesApi.getActiveChats(controller.signal)
            .then(setChats)
            .catch((err) => {
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('No se pudieron cargar los chats');
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, []);

    const ownerChats = useMemo(() => chats.filter((c) => c.owner_id === user?.id), [chats, user]);
    const borrowerChats = useMemo(() => chats.filter((c) => c.borrower_id === user?.id), [chats, user]);
    const adminDisputes = useMemo(() => chats.filter((c) => c.status === 'pending_review'), [chats]);

    const isAdmin = user?.role === 'admin';
    const scopedChats = isAdmin ? adminDisputes : (activeTab === 'owner' ? ownerChats : borrowerChats);
    const sortedChats = useMemo(() => [...scopedChats].sort(sortByDateDesc), [scopedChats]);

    if (!user) return null;

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">
            <h1 className="font-editorial text-3xl font-semibold">{isAdmin ? 'Incidencias' : 'Mis chats'}</h1>

            {!isAdmin && (
                <div className="flex border-b border-[var(--border)]">
                    {/* Botones de owner y borrower */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('owner')}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'owner'
                            ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                            : 'text-[var(--muted)] hover:text-[var(--text)]'
                            }`}
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            <Home className="h-4 w-4" />
                            Presto mi objeto
                        </span>
                        {!loading && ownerChats.length > 0 && (
                            <span className="ml-2 text-xs bg-[var(--surface-strong)] text-[var(--accent)] rounded-full px-1.5 py-0.5">
                                {ownerChats.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('borrower')}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'borrower'
                            ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                            : 'text-[var(--muted)] hover:text-[var(--text)]'
                            }`}
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            <Search className="h-4 w-4" />
                            Quiero alquilar
                        </span>
                        {!loading && borrowerChats.length > 0 && (
                            <span className="ml-2 text-xs bg-[var(--surface-strong)] text-[var(--accent)] rounded-full px-1.5 py-0.5">
                                {borrowerChats.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {loading && <ChatListSkeleton count={4} />}

            {error && (
                <p className="text-sm text-[var(--danger)] text-center py-8">{error}</p>
            )}

            {!loading && !error && chats.length === 0 && (
                <div className="text-center py-16 text-[var(--muted)]">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 text-[var(--accent-3)]" />
                    <p className="text-sm">No tienes conversaciones activas.</p>
                    <p className="text-xs mt-1">Los chats aparecen cuando haces o recibes una solicitud de préstamo.</p>
                </div>
            )}

            {!loading && !error && chats.length > 0 && (
                <ChatList chats={sortedChats} currentUserID={user.id} />
            )}
        </div>
    );
}
