import type { TransactionStatus } from '../../types';

interface AdminToolbarProps {
    transactionStatus?: TransactionStatus;
    decisionLoading: boolean;
    showRefundSlider: boolean;
    refundPercentage: number;
    refundAvailable: boolean;
    onResolveDisputeRequest: () => void;
    onShowRefundSlider: () => void;
    onHideRefundSlider: () => void;
    onRefundPercentageChange: (value: number) => void;
    onConfirmRefund: () => void;
}

export default function AdminToolbar({
    transactionStatus,
    decisionLoading,
    showRefundSlider,
    refundPercentage,
    refundAvailable,
    onResolveDisputeRequest,
    onShowRefundSlider,
    onHideRefundSlider,
    onRefundPercentageChange,
    onConfirmRefund,
}: AdminToolbarProps) {
    const canResolve = transactionStatus === 'pending_review';
    const canRefund =
        refundAvailable &&
        (transactionStatus === 'pending_review' || transactionStatus === 'returned');

    if (!canResolve && !canRefund) return null;

    return (
        <div className="flex flex-wrap items-center gap-3">
            {canResolve && (
                <button
                    type="button"
                    onClick={onResolveDisputeRequest}
                    disabled={decisionLoading}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:brightness-95 transition disabled:opacity-50"
                >
                    {decisionLoading ? 'Cerrando...' : 'Resolver incidencia'}
                </button>
            )}

            {canRefund && (
                <div className="flex items-center gap-2">
                    {showRefundSlider ? (
                        <div className="flex items-center gap-3 bg-[var(--surface-strong)] border border-[var(--border)] rounded-full px-4 py-1.5 shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-tight">Reembolso</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={refundPercentage}
                                        onChange={(e) => onRefundPercentageChange(parseInt(e.target.value))}
                                        className="w-24 h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                    />
                                    <span className="text-xs font-bold text-[var(--accent-3)] w-8">{refundPercentage}%</span>
                                </div>
                            </div>
                            <div className="flex gap-1 border-l border-[var(--border)] pl-2">
                                <button
                                    type="button"
                                    onClick={onConfirmRefund}
                                    disabled={decisionLoading}
                                    className="p-1.5 rounded-full bg-[var(--accent)] text-white hover:brightness-95 transition disabled:opacity-50"
                                    title="Confirmar reembolso"
                                >
                                    <span className="text-[10px] font-bold">OK</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={onHideRefundSlider}
                                    disabled={decisionLoading}
                                    className="p-1.5 rounded-full bg-white text-[var(--muted)] hover:bg-[var(--surface)] transition"
                                    title="Cancelar"
                                >
                                    <span className="text-[10px] font-bold">✕</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onShowRefundSlider}
                            className="flex-shrink-0 rounded-full bg-[var(--surface-strong)] border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--accent-3)] hover:bg-[var(--surface)] transition"
                        >
                            Devolver en puntos
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
