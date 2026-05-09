import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

const PLACEHOLDER_CODE = '123456';

export default function HandoverPage() {
    const navigate = useNavigate();
    const { id: listingId } = useParams<{ id: string }>();

    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!listingId) return;
        api.get<{ data: { id: string; status: string }[] }>(`/listings/${listingId}/transactions`)
            .then(r => {
                const active = r.data.find(t =>
                    t.status === 'agreed' || t.status === 'handed_over'
                );
                if (active) setTransactionId(active.id);
            })
            .catch(() => { });
    }, [listingId]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (code !== PLACEHOLDER_CODE) {
            setError('Código incorrecto. Inténtalo de nuevo.');
            return;
        }
        setError(null);
        setSuccess(true);
        setTimeout(() => navigate('/profile'), 1500);
    }

    return (
        <div className="max-w-md mx-auto p-6 flex flex-col gap-4">

            {/* Banner chat */}
            {transactionId && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-teal-800">¿Necesitáis coordinaros?</p>
                        <p className="text-xs text-teal-600 mt-0.5">
                            Concreta los detalles de la entrega con el arrendatario por el chat.
                        </p>
                    </div>
                    <Link
                        to={`/transactions/${transactionId}/chat`}
                        className="flex-shrink-0 text-sm font-medium bg-teal-700 text-white px-4 py-2 rounded-xl hover:bg-teal-800 transition"
                    >
                        Abrir chat
                    </Link>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <button onClick={() => navigate('/profile')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-6 block">
                    ← Volver
                </button>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Confirmar entrega</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Introduce el código que te ha proporcionado el arrendatario para confirmar la entrega del objeto.
                </p>

                {success ? (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        ✓ Entrega confirmada correctamente
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Código de entrega (6 dígitos)
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={code}
                                onChange={e => { setCode(e.target.value); setError(null); }}
                                placeholder="000000"
                                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}
                        <button type="submit"
                            className="w-full bg-teal-700 text-white rounded-lg px-4 py-2 font-medium hover:bg-teal-800 transition">
                            Confirmar entrega
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}