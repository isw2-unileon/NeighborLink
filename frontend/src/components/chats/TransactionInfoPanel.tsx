import { Link } from 'react-router-dom';
import { Package, UserRound, X } from 'lucide-react';
import type { Listing, Transaction, User } from '../../types';

interface TransactionInfoPanelProps {
    listing: Listing;
    transaction: Transaction;
    owner: User | null;
    borrower: User | null;
    otherParticipant?: User | null;
    onClose: () => void;
}

export default function TransactionInfoPanel({
    listing,
    transaction,
    owner,
    borrower,
    otherParticipant,
    onClose,
}: TransactionInfoPanelProps) {
    const start = transaction.start_date ? new Date(transaction.start_date) : null;
    const end = transaction.end_date ? new Date(transaction.end_date) : null;
    const days =
        start && end
            ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
            : null;
    const totalEuros = transaction.total_charged_cents
        ? (transaction.total_charged_cents / 100).toFixed(2)
        : days
            ? (days * listing.deposit_amount + 2).toFixed(2)
            : '—';

    const formatDate = (d: Date) =>
        d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <>
            {/* Overlay oscuro — click fuera cierra el panel */}
            <div
                className="fixed inset-0 z-40 bg-black/30"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel lateral derecho */}
            <div className="fixed top-0 right-0 z-50 h-full w-full max-w-xs bg-white shadow-2xl flex flex-col overflow-y-auto">
                {/* Header del panel */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wide">
                        Detalles
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-strong)] transition text-[var(--muted)]"
                        aria-label="Cerrar panel de detalles"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Contenido */}
                <div className="flex flex-col gap-5 p-5">
                    {/* Foto + título del objeto */}
                    <div className="flex items-center gap-3">
                        {listing.photos?.[0] ? (
                            <img
                                src={listing.photos[0]}
                                alt={listing.title}
                                className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-[var(--surface-strong)] flex items-center justify-center text-[var(--muted)] flex-shrink-0">
                                <Package className="w-6 h-6" />
                            </div>
                        )}
                        <p className="text-sm font-semibold text-[var(--text)] leading-tight">
                            {listing.title}
                        </p>
                    </div>

                    <div className="h-px bg-[var(--border)]" />

                    {/* Participantes */}
                    <div className="flex flex-col gap-3">
                        <div>
                            <p className="text-xs text-[var(--muted)] mb-0.5">Prestador</p>
                            <p className="text-sm font-medium text-[var(--text)]">
                                {owner?.name ?? '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--muted)] mb-0.5">Solicitante</p>
                            <p className="text-sm font-medium text-[var(--text)]">
                                {borrower?.name ?? '—'}
                            </p>
                        </div>
                        {otherParticipant?.id && (
                            <Link
                                to={`/users/${otherParticipant.id}`}
                                onClick={onClose}
                                className="mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--accent-3)] hover:bg-[var(--surface-strong)] transition"
                            >
                                <UserRound className="w-4 h-4" />
                                Ver perfil
                            </Link>
                        )}
                    </div>

                    <div className="h-px bg-[var(--border)]" />

                    {/* Fechas y precio */}
                    <div className="flex flex-col gap-3">
                        <div>
                            <p className="text-xs text-[var(--muted)] mb-0.5">Fechas</p>
                            {start && end ? (
                                <p className="text-sm font-medium text-[var(--text)]">
                                    {formatDate(start)} → {formatDate(end)}
                                </p>
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
                            <p className="text-base font-bold text-[var(--accent)]">
                                {totalEuros} €
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}