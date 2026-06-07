import { useState, useRef } from 'react';
import PaymentForm, { type PaymentFormHandle } from './PaymentForm';
import { transactionsApi } from '../lib/transactions';

type PaymentStep = 'select' | 'card' | 'points';

interface Props {
    transactionId: string;
    depositAmount: number;
    startDate: string;
    endDate: string;
    userPoints: number;
    onClose: () => void;
    onSuccess: () => void;
    onPointsDeducted?: (cents: number) => void;
}

export default function PaymentModal({
    transactionId,
    depositAmount,
    startDate,
    endDate,
    userPoints,
    onClose,
    onSuccess,
    onPointsDeducted,
}: Props) {
    const [step, setStep] = useState<PaymentStep>('select');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const paymentFormRef = useRef<PaymentFormHandle>(null);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.round(diffMs / 86400000)) || 1;
    const depositCents = Math.round(days * Number(depositAmount) * 100) || 0;
    const totalCents = depositCents + 200;
    const totalEuros = totalCents / 100;
    const canPayWithPoints = userPoints >= totalCents;

    async function handleCardPay() {
        if (!paymentFormRef.current) return;
        setSubmitting(true);
        setError(null);
        try {
            const pmId = await paymentFormRef.current.createPaymentMethod();
            const { clientSecret } = await transactionsApi.pay(transactionId, depositCents, pmId, 'card');
            await paymentFormRef.current.handleNextAction(clientSecret);
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al procesar el pago');
        } finally {
            setSubmitting(false);
        }
    }

    async function handlePointsPay() {
        setSubmitting(true);
        setError(null);
        try {
            await transactionsApi.pay(transactionId, depositCents, null, 'points');
            onPointsDeducted?.(totalCents);
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al procesar el pago con puntos');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[28px] shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        {step !== 'select' && (
                            <button
                                onClick={() => { setStep('select'); setError(null); }}
                                className="text-gray-400 hover:text-gray-600 mr-1"
                                aria-label="Volver"
                            >
                                ←
                            </button>
                        )}
                        <h2 className="text-xl font-semibold">
                            {step === 'select' ? 'Método de pago' : step === 'card' ? 'Datos de pago' : 'Pagar con puntos'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                {error && (
                    <p className="text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 text-sm">
                        {error}
                    </p>
                )}

                {step === 'select' && (
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => setStep('card')}
                            className="w-full flex flex-col items-start p-4 border-2 border-gray-200 rounded-2xl hover:border-[var(--accent)] transition-colors text-left"
                        >
                            <span className="font-semibold text-base">Pagar con tarjeta</span>
                            <span className="text-sm text-gray-500 mt-1">Total: {totalEuros.toFixed(2)} €</span>
                        </button>

                        {canPayWithPoints && (
                            <button
                                onClick={() => setStep('points')}
                                className="w-full flex flex-col items-start p-4 border-2 border-gray-200 rounded-2xl hover:border-[var(--accent)] transition-colors text-left"
                            >
                                <span className="font-semibold text-base">Pagar con puntos</span>
                                <span className="text-sm text-gray-500 mt-1">
                                    Coste: {(totalCents / 100).toFixed(2)} pts · Saldo: {(userPoints / 100).toFixed(2)} pts
                                </span>
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-[var(--surface-strong)] rounded-full font-semibold mt-2"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {step === 'card' && (
                    <>
                        <PaymentForm ref={paymentFormRef} totalEuros={totalEuros} />
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-[var(--surface-strong)] rounded-full font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCardPay}
                                disabled={submitting}
                                className="flex-1 bg-[var(--accent)] text-white py-2 rounded-full hover:brightness-95 disabled:opacity-50 font-semibold"
                            >
                                {submitting ? 'Pagando...' : 'Confirmar pago'}
                            </button>
                        </div>
                    </>
                )}

                {step === 'points' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-gray-50 rounded-2xl p-4 text-sm">
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Saldo actual</span>
                                <span className="font-semibold">{(userPoints / 100).toFixed(2)} pts</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Coste del depósito</span>
                                <span className="font-semibold text-red-600">−{(totalCents / 100).toFixed(2)} pts</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between">
                                <span className="text-gray-600">Saldo tras el pago</span>
                                <span className="font-semibold">{((userPoints - totalCents) / 100).toFixed(2)} pts</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-[var(--surface-strong)] rounded-full font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePointsPay}
                                disabled={submitting}
                                className="flex-1 bg-[var(--accent)] text-white py-2 rounded-full hover:brightness-95 disabled:opacity-50 font-semibold"
                            >
                                {submitting ? 'Procesando...' : 'Confirmar pago'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
