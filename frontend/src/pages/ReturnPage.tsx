import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function ReturnPage() {
    const navigate = useNavigate();
    const { id: listingId } = useParams<{ id: string }>();

    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [depositAmountCents, setDepositAmountCents] = useState<number>(0);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!listingId) return;
        api.get<{ data: { id: string; status: string; total_charged_cents?: number }[] }>(
            `/listings/${listingId}/transactions`
        ).then(r => {
            const active = r.data.find(t => t.status === 'handed_over');
            if (active) {
                setTransactionId(active.id);
                // total_charged_cents is deposit + fee, but the backend handles the share calculation.
                // We send the full amount charged as base for the variable refund.
                setDepositAmountCents(active.total_charged_cents ?? 0);
            }
        }).catch(() => { });
    }, [listingId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!transactionId) return;
        setLoading(true);
        setError(null);
        try {
            await api.post(`/transactions/${transactionId}/confirm-return`, {
                code,
                deposit_amount_cents: depositAmountCents,
            });
            setSuccess(true);
            setTimeout(() => navigate('/profile'), 1500);
        } catch {
            setError('Código incorrecto o error al confirmar. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-4">
            {transactionId && (
                <div className="glass-panel rounded-3xl p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-[var(--accent-2)]">¿Necesitáis coordinaros?</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                            Concreta los detalles de la recogida con el arrendatario por el chat.
                        </p>
                    </div>
                    <Link
                        to={`/transactions/${transactionId}/chat`}
                        className="flex-shrink-0 text-sm font-semibold bg-[var(--accent-2)] text-white px-4 py-2 rounded-full hover:brightness-95 transition"
                    >
                        Abrir chat
                    </Link>
                </div>
            )}
            <div className="glass-panel rounded-3xl p-8">
                <button onClick={() => navigate('/profile')}
                    className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6 block">
                    ← Volver
                </button>
                <h1 className="font-editorial text-2xl font-semibold mb-2">Confirmar devolución</h1>
                <p className="text-sm text-[var(--muted)] mb-6">
                    Introduce el código que te ha proporcionado el arrendatario para confirmar la devolución del objeto.
                </p>
                {success ? (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                        ✓ Devolución confirmada correctamente
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                                Código de devolución (6 dígitos)
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={code}
                                onChange={e => { setCode(e.target.value); setError(null); }}
                                placeholder="000000"
                                className="w-full border border-[var(--border)] rounded-2xl px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                                {error}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || code.length !== 6}
                            className="w-full bg-[var(--accent-2)] text-white rounded-full px-4 py-2.5 font-semibold hover:brightness-95 transition disabled:opacity-50"
                        >
                            {loading ? 'Confirmando...' : 'Confirmar devolución'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}