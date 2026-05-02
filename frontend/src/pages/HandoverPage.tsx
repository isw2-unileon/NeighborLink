import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PLACEHOLDER_CODE = '123456';

export default function HandoverPage() {
    const navigate = useNavigate();

    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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
        <div className="max-w-md mx-auto p-6 flex flex-col gap-6">
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