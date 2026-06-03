import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '../../lib/users';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import { listingsApi } from '../../lib/listings';
import type { Message, Listing, Transaction, User } from '../../types'; // ← User añadido
import { api } from '../../lib/api';
import PaymentModal from '../../components/PaymentModal';

const POLL_INTERVAL_MS = 3000;

function MessageBubble({
    message,
    isMe,
    isBorrower,
    transactionStatus,
    onOpenPayment
}: {
    message: Message;
    isMe: boolean;
    isBorrower: boolean;
    transactionStatus?: string;
    onOpenPayment: () => void;
}) {
    const isSystem = message.sender_id === '00000000-0000-0000-0000-000000000000';

    if (isSystem) {
        const isPaymentPrompt = message.content.toLowerCase().includes('métodos de pago');
        const isAlreadyPaid = transactionStatus !== 'awaiting_payment' && transactionStatus !== 'pending';
        if (isPaymentPrompt && (isAlreadyPaid || !isBorrower)) return null;

        return (
            <div className="flex justify-center w-full my-2">
                <div className="max-w-md px-6 py-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm text-center shadow-sm">
                    <p className="font-medium">{message.content}</p>
                    {isPaymentPrompt && isBorrower && !isAlreadyPaid && (
                        <button
                            onClick={(e) => { e.preventDefault(); onOpenPayment(); }}
                            className="mt-3 w-full bg-[var(--accent)] text-white px-6 py-2.5 rounded-full text-sm font-bold hover:brightness-95 transition-all shadow-md active:scale-95"
                        >
                            💳 Confirmar y Pagar fianza
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMe
                ? 'bg-[var(--accent-2)] text-white rounded-br-sm'
                : 'bg-white border border-[var(--border)] text-gray-800 rounded-bl-sm'
                }`}>
                <p>{message.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                    {new Date(message.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit', minute: '2-digit'
                    })}
                </p>
            </div>
        </div>
    );
}

function EleccionModal({
    onClose, onAccept, onReject, loading
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
                    <p className="text-sm text-gray-500">¿Deseas aceptar o rechazar esta solicitud?</p>
                </div>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <span className="text-amber-500 text-base mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700 leading-relaxed">Esta decisión no se podrá deshacer después.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onAccept} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50">Aceptar</button>
                    <button onClick={onReject} disabled={loading} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50">Rechazar</button>
                </div>
                <button onClick={onClose} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 text-center transition">Cancelar</button>
            </div>
        </div>
    );
}

// ── FUERA de ChatDetailPage ──
function TransactionInfoPanel({
    listing,
    transaction,
    owner,
    borrower,
}: {
    listing: Listing;
    transaction: Transaction;
    owner: User | null;
    borrower: User | null;
}) {
    const start = transaction.start_date ? new Date(transaction.start_date) : null;
    const end = transaction.end_date ? new Date(transaction.end_date) : null;
    const days = start && end
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
        : null;
    const totalEuros = transaction.total_charged_cents
        ? (transaction.total_charged_cents / 100).toFixed(2)
        : days
            ? ((days * listing.deposit_amount) + 2).toFixed(2)
            : '—';

    const formatDate = (d: Date) =>
        d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-white p-5 flex flex-col gap-5 overflow-y-auto">
            <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wide">Detalles</h2>

            <div className="flex items-center gap-3">
                {listing.photos?.[0] ? (
                    <img src={listing.photos[0]} alt={listing.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                    <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
                )}
                <p className="text-sm font-semibold text-[var(--text)] leading-tight">{listing.title}</p>
            </div>

            <div className="h-px bg-[var(--border)]" />

            <div className="flex flex-col gap-3">
                <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">Prestador</p>
                    <p className="text-sm font-medium text-[var(--text)]">{owner?.name ?? '—'}</p>
                </div>
                <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">Solicitante</p>
                    <p className="text-sm font-medium text-[var(--text)]">{borrower?.name ?? '—'}</p>
                </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            <div className="flex flex-col gap-3">
                <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">Fechas</p>
                    {start && end ? (
                        <p className="text-sm font-medium text-[var(--text)]">{formatDate(start)} → {formatDate(end)}</p>
                    ) : (
                        <p className="text-sm text-[var(--muted)]">No definidas</p>
                    )}
                </div>
                <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">Días</p>
                    <p className="text-sm font-medium text-[var(--text)]">{days ?? '—'}</p>
                </div>
                <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">Precio total</p>
                    <p className="text-base font-bold text-[var(--accent)]">{totalEuros} €</p>
                </div>
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
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [owner, setOwner] = useState<User | null>(null);
    const [borrower, setBorrower] = useState<User | null>(null);

    const [showEleccion, setShowEleccion] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [decisionLoading, setDecisionLoading] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);

    const isOwner = listing?.owner_id === user?.id;

    useEffect(() => {
        if (!transactionId) return;
        api.get<{ data: Transaction }>(`/transactions/${transactionId}`)
            .then(r => {
                setTransaction(r.data);
                return listingsApi.getById(r.data.listing_id);
            })
            .then(setListing)
            .catch(() => { });
    }, [transactionId]);

    useEffect(() => {
        if (!listing || !transaction) return;
        usersApi.getUser(listing.owner_id).then(r => setOwner(r));
        usersApi.getUser(transaction.borrower_id).then(r => setBorrower(r));
    }, [listing?.owner_id, transaction?.borrower_id]);

    useEffect(() => {
        if (transaction?.status === 'awaiting_payment' && !isOwner) {
            setShowPayment(true);
        }
    }, [transaction?.status, isOwner]);

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
                setTransaction(prev => prev ? { ...prev, status: 'awaiting_payment' } : null);
                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    transaction_id: transactionId,
                    sender_id: '00000000-0000-0000-0000-000000000000',
                    content: 'El prestador ha aceptado las condiciones propuestas, ahora mete los métodos de pago.',
                    created_at: new Date().toISOString(),
                }]);
            } else {
                setTransaction(prev => prev ? { ...prev, status: 'cancelled' } : null);
                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    transaction_id: transactionId,
                    sender_id: '00000000-0000-0000-0000-000000000000',
                    content: 'El prestador no ha aceptado las condiciones.',
                    created_at: new Date().toISOString(),
                }]);
            }
        } catch {
            setError('No se pudo guardar la decisión');
        } finally {
            setDecisionLoading(false);
        }
    }

    async function handlePaymentSuccess() {
        setShowPayment(false);
        setTransaction(prev => prev ? { ...prev, status: 'agreed' } : null);
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            transaction_id: transactionId!,
            sender_id: '00000000-0000-0000-0000-000000000000',
            content: '¡Pago completado! La reserva ahora está confirmada.',
            created_at: new Date().toISOString(),
        }]);
    }

    if (!user) return null;
    const transactionStatus = transaction?.status;

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

            {showPayment && transaction && listing && (
                <PaymentModal
                    transactionId={transactionId!}
                    depositAmount={listing.deposit_amount}
                    startDate={transaction.start_date ?? ''}
                    endDate={transaction.end_date ?? ''}
                    onClose={() => setShowPayment(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}

            {/* ── Contenedor principal: panel izq + chat ── */}
            <div className="flex fixed inset-x-0 bottom-0" style={{ top: '4rem' }}>

                {/* Panel lateral izquierdo */}
                {listing && transaction && (
                    <TransactionInfoPanel
                        listing={listing}
                        transaction={transaction}
                        owner={owner}
                        borrower={borrower}
                    />
                )}

                {/* Chat */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[var(--border)] bg-white flex items-center gap-3">
                        <button onClick={() => navigate('/chats')} className="text-sm text-[var(--muted)] hover:text-[var(--text)] mr-1">←</button>

                        {listing?.photos?.[0] ? (
                            <img src={listing.photos[0]} alt={listing.title} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
                        )}

                        <div className="flex-1 min-w-0">
                            <h1 className="text-base font-semibold text-[var(--text)]">{listing?.title ?? 'Chat'}</h1>
                            <p className="text-xs text-[var(--muted)]">Transacción {transactionId?.slice(0, 8)}…</p>
                        </div>

                        {isOwner && transactionStatus === 'pending' && (
                            <button onClick={() => setShowEleccion(true)} className="flex-shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:brightness-95 transition">Elección</button>
                        )}
                        {transactionStatus === 'awaiting_payment' && (
                            <div className="flex-shrink-0 rounded-full border border-green-300 bg-green-100 px-3 py-2 text-xs font-bold text-green-700">ACEPTADO</div>
                        )}
                        {transactionStatus === 'cancelled' && (
                            <div className="flex-shrink-0 rounded-full border border-red-300 bg-red-100 px-3 py-2 text-xs font-bold text-red-700">DENEGADO</div>
                        )}
                    </div>

                    {/* Mensajes */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 bg-[var(--surface-strong)]">
                        {messages.length === 0 && (
                            <p className="text-sm text-[var(--muted)] text-center mt-8">No hay mensajes aún. ¡Empieza la conversación!</p>
                        )}
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isMe={msg.sender_id === user.id}
                                isBorrower={!isOwner}
                                transactionStatus={transactionStatus}
                                onOpenPayment={() => setShowPayment(true)}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {error && (
                        <p className="bg-red-50 py-1 text-center text-xs text-red-500">{error}</p>
                    )}

                    {/* Input */}
                    <form onSubmit={handleSend} className="px-6 py-4 border-t border-[var(--border)] bg-white flex gap-3 items-center">
                        <input
                            type="text"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe un mensaje…"
                            className="flex-1 rounded-2xl border border-[var(--border)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={sending || !content.trim()}
                            className="rounded-full bg-[var(--accent-2)] px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                        >
                            {sending ? '…' : 'Enviar'}
                        </button>
                    </form>
                </div>

            </div>
        </>
    );
}