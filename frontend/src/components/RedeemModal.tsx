import { useState } from 'react';
import { walletApi } from '../lib/wallet';

interface RedeemModalProps {
    points: number;
    onClose: () => void;
    onSuccess: () => void;
}

export function RedeemModal({ points, onClose, onSuccess }: RedeemModalProps) {
    const maxPoints = points;
    const [pointsToRedeem, setPointsToRedeem] = useState(maxPoints);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const MIN = 1000;
    const isValid = pointsToRedeem >= MIN && pointsToRedeem <= maxPoints;
    const euros = (pointsToRedeem / 100).toFixed(2);

    async function handleConfirm() {
        setLoading(true);
        setError(null);
        try {
            await walletApi.redeemPoints(pointsToRedeem);
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al canjear puntos');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="glass-panel soft-shadow rounded-3xl p-6 w-full max-w-sm mx-4 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[var(--text)]">Canjear puntos</h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--muted)] hover:text-[var(--text)] transition text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Puntos a canjear
                    </label>
                    <input
                        type="number"
                        min={MIN}
                        max={maxPoints}
                        step={100}
                        value={pointsToRedeem}
                        onChange={e => setPointsToRedeem(Number(e.target.value))}
                        className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <p className="text-sm text-[var(--muted)]">
                        Equivale a{' '}
                        <span className="font-semibold text-[var(--accent-2)]">€{euros}</span>
                    </p>
                    {pointsToRedeem < MIN && (
                        <p className="text-xs text-red-500">Mínimo {(MIN / 100).toFixed(2)} puntos (€{(MIN / 100).toFixed(2)}).</p>
                    )}
                    {pointsToRedeem > maxPoints && (
                        <p className="text-xs text-red-500">No puedes canjear más de {(maxPoints / 100).toFixed(2)} puntos.</p>
                    )}
                </div>

                {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 text-sm font-semibold px-4 py-2 rounded-full border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-strong)] transition disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid || loading}
                        className="flex-1 text-sm font-semibold px-4 py-2 rounded-full bg-[var(--accent-2)] text-white border border-[var(--accent-2)] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Procesando…' : 'Confirmar canje'}
                    </button>
                </div>
            </div>
        </div>
    );
}
