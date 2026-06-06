import { useState, useRef } from 'react';
import PaymentForm, { type PaymentFormHandle } from './PaymentForm';
import { transactionsApi } from '../lib/transactions';

interface Props {
    transactionId: string;
    depositAmount: number;
    startDate: string;
    endDate: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PaymentModal({
    transactionId,
    depositAmount,
    startDate,
    endDate,
    onClose,
    onSuccess
}: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const paymentFormRef = useRef<PaymentFormHandle>(null);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.round(diffMs / 86400000)) || 1; // Default to 1 day if invalid
    const depositCents = Math.round(Number(depositAmount) * 100) || 0;
    const totalEuros = (depositCents + 200) / 100;

    async function handlePay() {
        if (!paymentFormRef.current) return;
        setSubmitting(true);
        setError(null);
        try {
            const pmId = await paymentFormRef.current.createPaymentMethod();
            const { clientSecret } = await transactionsApi.pay(transactionId, depositCents, pmId);
            await paymentFormRef.current.handleNextAction(clientSecret);
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al procesar el pago');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[28px] shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Datos de pago</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                {error && (
                    <p className="text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 text-sm">
                        {error}
                    </p>
                )}

                <PaymentForm ref={paymentFormRef} totalEuros={totalEuros} />

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[var(--surface-strong)] rounded-full font-semibold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePay}
                        disabled={submitting}
                        className="flex-1 bg-[var(--accent)] text-white py-2 rounded-full hover:brightness-95 disabled:opacity-50 font-semibold"
                    >
                        {submitting ? 'Pagando...' : 'Confirmar pago'}
                    </button>
                </div>
            </div>
        </div>
    );
}
