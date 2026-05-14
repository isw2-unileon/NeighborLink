import { useNavigate, useParams, Link } from 'react-router-dom';

const PLACEHOLDER_CODE = '654321';

export default function BorrowerReturnPage() {
    const navigate = useNavigate();
    const { id: transactionId } = useParams<{ id: string }>();

    return (
        <div className="max-w-md mx-auto p-6 flex flex-col gap-4">

            {/* Banner chat */}
            {transactionId && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-teal-800">¿Necesitáis coordinaros?</p>
                        <p className="text-xs text-teal-600 mt-0.5">
                            Concreta los detalles de la recogida con el propietario por el chat.
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
                <h1 className="text-xl font-bold text-gray-900 mb-2">Código de devolución</h1>
                <p className="text-sm text-gray-500 mb-8">
                    Muestra este código al propietario para que confirme la devolución del objeto.
                </p>

                <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl font-bold tracking-widest text-teal-700">
                        {PLACEHOLDER_CODE}
                    </span>
                    <p className="text-xs text-gray-400">Código de 6 dígitos</p>
                </div>
            </div>
        </div>
    );
}