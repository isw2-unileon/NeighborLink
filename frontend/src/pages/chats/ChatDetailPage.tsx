import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usersApi } from '../../lib/users';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../lib/messages';
import { listingsApi } from '../../lib/listings';
import { transactionsApi } from '../../lib/transactions';
import type { Message, Listing, Transaction, User, TransactionStatus } from '../../types';
import PaymentModal from '../../components/PaymentModal';
import MessageBubble from '../../components/chats/MessageBubble';
import DecisionModal from '../../components/chats/DecisionModal';
import TransactionInfoPanel from '../../components/chats/TransactionInfoPanel';
import AdminToolbar from '../../components/chats/AdminToolbar';
import ConfirmModal from '../../components/chats/ConfirmModal';

const POLL_INTERVAL_MS = 3000;

type StatusBadge = {
    label: string;
    className: string;
};

function getStatusBadge(status?: TransactionStatus): StatusBadge | null {
    switch (status) {
        case 'pending':
            return {
                label: 'PENDIENTE',
                className: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
            };
        case 'awaiting_payment':
            return {
                label: 'PAGO PENDIENTE',
                className: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
            };
        case 'agreed':
            return {
                label: 'CONFIRMADO',
                className: 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
            };
        case 'pending_review':
            return {
                label: 'EN REVISIÓN',
                className: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
            };
        case 'returned':
            return {
                label: 'FINALIZADO',
                className: 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)]',
            };
        case 'cancelled':
            return {
                label: 'DENEGADO',
                className: 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]',
            };
        default:
            return null;
    }
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
    const [refundPercentage, setRefundPercentage] = useState(50);
    const [showRefundSlider, setShowRefundSlider] = useState(false);
    const [showResolveConfirm, setShowResolveConfirm] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);

    useEffect(() => {
        if (!transactionId) return;
        api.get<{ data: Transaction }>(`/transactions/${transactionId}`)
            .then((r) => {
                setTransaction(r.data);
                return listingsApi.getById(r.data.listing_id);
            })
            .then(setListing)
            .catch(() => { });
    }, [transactionId]);

    useEffect(() => {
        if (!listing || !transaction) return;
        usersApi.getUser(listing.owner_id).then((r) => setOwner(r));
        usersApi.getUser(transaction.borrower_id).then((r) => setBorrower(r));
    }, [listing, transaction]);

    useEffect(() => {
        if (!transactionId) return;

        const controller = new AbortController();
        let isActive = true;

        const fetchMessages = async () => {
            try {
                const msgs = await messagesApi.getByTransaction(transactionId, controller.signal);
                if (!isActive) return;
                setMessages(msgs);
                if (!initialScrollDone.current) {
                    setTimeout(() => {
                        if (!isActive) return;
                        bottomRef.current?.scrollIntoView({ behavior: 'instant' });
                        initialScrollDone.current = true;
                    }, 50);
                }
            } catch (err) {
                if (!isActive) return;
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('No se pudieron cargar los mensajes');
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
        return () => {
            isActive = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [transactionId]);

    if (!user) return null;

    const isOwner = listing?.owner_id === user.id;
    const isBorrower = transaction?.borrower_id === user.id;
    const transactionStatus = transaction?.status;
    const statusBadge = getStatusBadge(transactionStatus);
    const otherParticipant = isOwner ? borrower : owner;
    const refundAvailable = transaction?.dispute_refund_points === undefined;

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!content.trim() || !transactionId) return;

        setSending(true);
        setError(null);
        try {
            const newMsg = await messagesApi.create(transactionId, content.trim());
            setMessages((prev) => [...prev, newMsg]);
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
                setTransaction((prev) => (prev ? { ...prev, status: 'awaiting_payment' } : null));
            } else {
                setTransaction((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
                setMessages((prev) => [
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

    async function handleResolveDispute() {
        if (!transactionId) return;

        setShowResolveConfirm(false);
        setDecisionLoading(true);
        setError(null);
        try {
            await transactionsApi.resolveDispute(transactionId);
            setTransaction((prev) => (prev ? { ...prev, status: 'returned' } : null));
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    transaction_id: transactionId,
                    sender_id: '00000000-0000-0000-0000-000000000000',
                    content: 'INCIDENCIA RESUELTA: Un administrador ha cerrado este caso. La transacción se marca como finalizada.',
                    created_at: new Date().toISOString(),
                },
            ]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al procesar el reembolso.');
        } finally {
            setDecisionLoading(false);
        }
    }

    async function handleRefundPoints() {
        if (!transactionId) return;
        setDecisionLoading(true);
        setError(null);
        try {
            await transactionsApi.refundDisputePoints(transactionId, refundPercentage);
            setTransaction((prev) =>
                prev
                    ? {
                        ...prev,
                        dispute_refund_points: ((listing?.deposit_amount || 0) * refundPercentage) / 100,
                    }
                    : null
            );
            setShowRefundSlider(false);
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    transaction_id: transactionId,
                    sender_id: '00000000-0000-0000-0000-000000000000',
                    content: `REEMBOLSO DE PUNTOS: Un administrador ha concedido un reembolso del ${refundPercentage}% del valor del objeto en puntos.`,
                    created_at: new Date().toISOString(),
                },
            ]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al procesar el reembolso.');
        } finally {
            setDecisionLoading(false);
        }
    }

    async function handlePaymentSuccess() {
        setShowPayment(false);
        setTransaction((prev) => (prev ? { ...prev, status: 'agreed' } : null));
        setMessages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                transaction_id: transactionId!,
                sender_id: '00000000-0000-0000-0000-000000000000',
                content: '¡Pago completado! La reserva ahora está confirmada.',
                created_at: new Date().toISOString(),
            },
        ]);
    }

    const handleOpenPayment = async () => {
        if (!transactionId || !isBorrower) return;
        try {
            const t = await transactionsApi.getById(transactionId);
            setTransaction(t);
            if (t.status === 'awaiting_payment') setShowPayment(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo abrir el pago');
        }
    };

    const canShowDetails = Boolean(listing && transaction);

    return (
        <>
            {showEleccion && (
                <DecisionModal
                    onClose={() => setShowEleccion(false)}
                    onAccept={() => handleDecision('accept')}
                    onReject={() => handleDecision('reject')}
                    loading={decisionLoading}
                />
            )}

            {showResolveConfirm && (
                <ConfirmModal
                    title="Resolver incidencia"
                    description="¿Seguro que quieres cerrar la incidencia? Esto marcará la transacción como finalizada."
                    confirmLabel="Confirmar"
                    loading={decisionLoading}
                    onConfirm={handleResolveDispute}
                    onCancel={() => setShowResolveConfirm(false)}
                />
            )}

            {showPayment && isBorrower && transaction && listing && (
                <PaymentModal
                    transactionId={transactionId!}
                    depositAmount={listing.deposit_amount}
                    startDate={transaction.start_date ?? ''}
                    endDate={transaction.end_date ?? ''}
                    onClose={() => setShowPayment(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}

            {/* Panel de detalles — drawer flotante, fuera del flex del chat */}
            {showDetails && listing && transaction && (
                <TransactionInfoPanel
                    listing={listing}
                    transaction={transaction}
                    owner={owner}
                    borrower={borrower}
                    otherParticipant={otherParticipant}
                    onClose={() => setShowDetails(false)}
                />
            )}

            <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <div className="px-6 py-4 border-b border-[var(--border)] bg-white flex flex-col gap-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => navigate('/chats')}
                                    className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
                                >
                                    ←
                                </button>

                                {listing?.photos?.[0] ? (
                                    <img
                                        src={listing.photos[0]}
                                        alt={listing.title}
                                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-strong)] flex items-center justify-center text-[var(--muted)] flex-shrink-0">
                                        <span className="text-sm font-semibold">NL</span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <h1 className="text-base font-semibold text-[var(--text)] truncate">
                                        {listing?.title ?? 'Chat'}
                                    </h1>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                                {statusBadge && (
                                    <div className={`rounded-full border px-3 py-2 text-xs font-bold ${statusBadge.className}`}>
                                        {statusBadge.label}
                                    </div>
                                )}
                                {isOwner && transactionStatus === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowEleccion(true)}
                                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:brightness-95 transition"
                                    >
                                        Elección
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowDetails((prev) => !prev)}
                                    disabled={!canShowDetails}
                                    className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-strong)] transition disabled:opacity-50"
                                >
                                    {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
                                </button>
                            </div>
                        </div>

                        {user.role === 'admin' && (
                            <AdminToolbar
                                transactionStatus={transactionStatus}
                                decisionLoading={decisionLoading}
                                showRefundSlider={showRefundSlider}
                                refundPercentage={refundPercentage}
                                refundAvailable={refundAvailable}
                                onResolveDisputeRequest={() => setShowResolveConfirm(true)}
                                onShowRefundSlider={() => setShowRefundSlider(true)}
                                onHideRefundSlider={() => setShowRefundSlider(false)}
                                onRefundPercentageChange={setRefundPercentage}
                                onConfirmRefund={handleRefundPoints}
                            />
                        )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-3 bg-[var(--surface-strong)]">
                        {messages.length === 0 && (
                            <p className="text-sm text-[var(--muted)] text-center mt-8">
                                No hay mensajes aún. ¡Empieza la conversación!
                            </p>
                        )}
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isMe={msg.sender_id === user.id}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {error && (
                        <p className="bg-red-50 py-1 text-center text-xs text-red-500">{error}</p>
                    )}
                    {/* Banner fijo de pago — solo visible para el borrower cuando status = awaiting_payment */}
                    {transactionStatus === 'awaiting_payment' && isBorrower && (
                        <div className="px-6 py-3 border-t border-amber-200 bg-amber-50 flex items-center justify-between gap-4">
                            <p className="text-sm text-amber-800 font-medium">
                                💳 Tienes un pago pendiente para confirmar esta reserva
                            </p>
                            <button
                                type="button"
                                onClick={handleOpenPayment}
                                className="flex-shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white hover:brightness-95 transition active:scale-95"
                            >
                                Pagar fianza
                            </button>
                        </div>
                    )}

                    <form
                        onSubmit={handleSend}
                        className="px-6 py-4 border-t border-[var(--border)] bg-white flex gap-3 items-center"
                    >
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