import { useState, useEffect } from 'react';
import { DayPicker, DateRange as DayPickerRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { reservationsApi, DateRange } from '../lib/reservations';

interface Props {
    listingId: string;
    depositAmount: number;
    onClose: () => void;
    onSuccess: () => void;
}

interface DefinedRange {
    from: Date;
    to: Date;
}

function luhnCheck(num: string): boolean {
    const digits = num.replace(/\s/g, '').split('').reverse().map(Number);
    const sum = digits.reduce((acc, d, i) => {
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        return acc + d;
    }, 0);
    return sum % 10 === 0;
}

function formatCardNumber(value: string): string {
    return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
    const clean = value.replace(/\D/g, '').slice(0, 4);
    return clean.length > 2 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean;
}

export default function ReserveModal({ listingId, depositAmount, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<'calendar' | 'payment'>('calendar');
    const [range, setRange] = useState<DefinedRange | undefined>();  // ← tipo DefinedRange
    const [blockedDates, setBlockedDates] = useState<DateRange[]>([]);
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardError, setCardError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        reservationsApi.getAvailability(listingId).then(setBlockedDates).catch(console.error);
    }, [listingId]);

    const disabledDays = blockedDates.flatMap(({ start_date, end_date }) => {
        const days = [];
        const current = new Date(start_date);
        const end = new Date(end_date);
        while (current <= end) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    });

    const days = range ? Math.round((range.to.getTime() - range.from.getTime()) / 86400000) : 0;
    const total = days * depositAmount;

    function handleRangeSelect(r: DayPickerRange | undefined) {
        if (!r?.from || !r?.to) {
            setRange(undefined);
            return;
        }
        const selectedDays = Math.round((r.to.getTime() - r.from.getTime()) / 86400000);
        if (selectedDays > 7) {
            setError('Máximo 7 días de préstamo');
            return;
        }
        setError(null);
        setRange({ from: r.from, to: r.to });  // ← siempre Date, nunca undefined
    }

    function validateCard(): boolean {
        const clean = cardNumber.replace(/\s/g, '');
        if (!luhnCheck(clean)) {
            setCardError('Número de tarjeta inválido');
            return false;
        }
        const [month, year] = expiry.split('/').map(Number);
        const now = new Date();
        if (!month || !year || month < 1 || month > 12 ||
            new Date(2000 + year, month - 1) < now) {
            setCardError('Fecha de caducidad inválida');
            return false;
        }
        if (cvv.length < 3) {
            setCardError('CVV inválido');
            return false;
        }
        setCardError(null);
        return true;
    }

    async function handleConfirm() {
        if (!validateCard() || !range) return;
        const startDate = range.from.toISOString().split('T')[0] ?? '';
        const endDate = range.to.toISOString().split('T')[0] ?? '';
        setSubmitting(true);
        setError(null);
        try {
            await reservationsApi.reserve(listingId, {
                start_date: startDate,
                end_date: endDate,
                payment_method_id: 'simulated',
            });
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al reservar');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                        {step === 'calendar' ? 'Elige las fechas' : 'Datos de pago'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                {error && (
                    <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
                        {error}
                    </p>
                )}

                {step === 'calendar' ? (
                    <>
                        <DayPicker
                            mode="range"
                            selected={range}
                            onSelect={handleRangeSelect}
                            disabled={[{ before: new Date() }, ...disabledDays]}
                            numberOfMonths={1}
                        />

                        {days > 0 && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">{days} días × {depositAmount} €</span>
                                    <span className="font-semibold">{total} €</span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setStep('payment')}
                            disabled={!range}
                            className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                            Continuar
                        </button>
                    </>
                ) : (
                    <>
                        <div className="space-y-4">
                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">Número de tarjeta</span>
                                <input
                                    value={cardNumber}
                                    onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                                    placeholder="1234 5678 9012 3456"
                                    maxLength={19}
                                    className="mt-1 block w-full border rounded-lg p-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </label>

                            <div className="flex gap-3">
                                <label className="block flex-1">
                                    <span className="text-sm font-medium text-gray-700">Caducidad</span>
                                    <input
                                        value={expiry}
                                        onChange={e => setExpiry(formatExpiry(e.target.value))}
                                        placeholder="MM/AA"
                                        maxLength={5}
                                        className="mt-1 block w-full border rounded-lg p-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block w-24">
                                    <span className="text-sm font-medium text-gray-700">CVV</span>
                                    <input
                                        value={cvv}
                                        onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="123"
                                        maxLength={4}
                                        className="mt-1 block w-full border rounded-lg p-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                            </div>

                            {cardError && <p className="text-red-600 text-sm">{cardError}</p>}

                            <div className="p-3 bg-blue-50 rounded-lg text-sm">
                                <div className="flex justify-between font-semibold">
                                    <span>Total a pagar</span>
                                    <span>{total} €</span>
                                </div>
                                <p className="text-gray-500 text-xs mt-1">Pago simulado — no se realizará ningún cargo real</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setStep('calendar')}
                                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                            >
                                Atrás
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={submitting}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                            >
                                {submitting ? 'Confirmando...' : 'Confirmar reserva'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}