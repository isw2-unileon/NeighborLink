import { useState, useEffect } from 'react';
import { DayPicker, DateRange as DayPickerRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { reservationsApi, DateRange } from '../lib/reservations';

interface Props {
    listingId: string;
    depositAmount: number;
    onClose: () => void;
    onSuccess: (transactionId: string) => void;
}

interface DefinedRange {
    from: Date;
    to: Date;
}

export default function ReserveModal({ listingId, depositAmount, onClose, onSuccess }: Props) {
    const [range, setRange] = useState<DefinedRange | undefined>();
    const [blockedDates, setBlockedDates] = useState<DateRange[]>([]);
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
        setRange({ from: r.from, to: r.to });
    }

    async function handleConfirm() {
        if (!range) return;
        
        // Función auxiliar para obtener YYYY-MM-DD en hora local
        const formatDateLocal = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const startDate = formatDateLocal(range.from);
        const endDate = formatDateLocal(range.to);
        setSubmitting(true);
        setError(null);
        try {
            const result = await reservationsApi.reserve(listingId, {
                start_date: startDate,
                end_date: endDate,
                payment_method_id: '', // Ya no se requiere aquí
            });
            onSuccess(result.id);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al reservar');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-[28px] shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Elige las fechas</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                {error && (
                    <p className="text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 text-sm">
                        {error}
                    </p>
                )}

                <DayPicker
                    mode="range"
                    selected={range}
                    onSelect={handleRangeSelect}
                    disabled={[{ before: new Date() }, ...disabledDays]}
                    numberOfMonths={1}
                />

                {days > 0 && (
                    <div className="mt-4 p-3 bg-[var(--surface-strong)] rounded-2xl text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--muted)]">{days} días × {depositAmount} €</span>
                            <span className="font-semibold">{total} €</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleConfirm}
                    disabled={!range || submitting}
                    className="w-full mt-4 bg-[var(--accent)] text-white py-2.5 rounded-full hover:brightness-95 disabled:opacity-50 font-semibold"
                >
                    {submitting ? 'Confirmando...' : 'Confirmar reserva'}
                </button>
            </div>
        </div>
    );
}
