import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function BorrowerReturnPage() {
    const navigate = useNavigate();
    const { id: transactionId } = useParams<{ id: string }>();
    const [code, setCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!transactionId) return;
        api.post<{ data: { code: string } }>(`/transactions/${transactionId}/generate-return-code`, {})
            .then(r => setCode(r.data.code))
            .catch(() => setError('No se pudo generar el código. Inténtalo de nuevo.'));
    }, [transactionId]);

    return (
        <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-4">
            {transactionId && (
                <div className="glass-panel rounded-3xl p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-[var(--accent-2)]">¿Necesitáis coordinaros?</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                            Concreta los detalles de la recogida con el propietario por el chat.
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
                <button onClick={() => navigate('/profile', { state: { tab: 'reservations' } })}
                    className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6 block">
                    ← Volver
                </button>
                <h1 className="font-editorial text-2xl font-semibold mb-2">Código de devolución</h1>
                <p className="text-sm text-[var(--muted)] mb-8">
                    Muestra este código al propietario para que confirme la devolución del objeto.
                </p>
                <div className="flex flex-col items-center gap-2">
                    {error ? (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{error}</p>
                    ) : code ? (
                        <>
                            <span className="text-5xl font-bold tracking-widest text-[var(--accent-2)]">{code}</span>
                            <p className="text-xs text-[var(--muted)]">Código de 6 dígitos</p>
                        </>
                    ) : (
                        <span className="text-[var(--muted)] text-sm">Generando código...</span>
                    )}
                </div>
            </div>
        </div>
    );
}