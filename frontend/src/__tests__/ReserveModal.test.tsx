import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ReserveModal from '../components/ReserveModal';
import * as reservationsLib from '../lib/reservations';

vi.mock('react-day-picker', () => ({
    DayPicker: ({ onSelect }: { onSelect: (r: { from: Date; to: Date }) => void }) => (
        <div data-testid="day-picker">
            <button
                onClick={() =>
                    onSelect({
                        from: new Date('2026-06-10'),
                        to: new Date('2026-06-14'),
                    })
                }
            >
                Seleccionar rango
            </button>
        </div>
    ),
}));

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn().mockResolvedValue(null),
}));

vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CardNumberElement: () => <div data-testid="card-number" />,
    CardExpiryElement: () => <div data-testid="card-expiry" />,
    CardCvcElement: () => <div data-testid="card-cvc" />,
    useStripe: () => ({
        createPaymentMethod: vi.fn().mockResolvedValue({
            paymentMethod: { id: 'pm_test_123' },
            error: undefined,
        }),
    }),
    useElements: () => ({ getElement: vi.fn().mockReturnValue({}) }),
}));

vi.mock('../lib/reservations');

const defaultProps = {
    listingId: 'listing-1',
    depositAmount: 20,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reservationsLib.reservationsApi.getAvailability).mockResolvedValue([]);
});

describe('ReserveModal', () => {
    it('muestra el calendario en el paso inicial', () => {
        render(<ReserveModal {...defaultProps} />);
        expect(screen.getByText('Elige las fechas')).toBeInTheDocument();
        expect(screen.getByTestId('day-picker')).toBeInTheDocument();
    });

    it('el botón confirmar reserva está deshabilitado sin fechas seleccionadas', () => {
        render(<ReserveModal {...defaultProps} />);
        expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled();
    });

    it('llama a onClose al pulsar ✕', () => {
        render(<ReserveModal {...defaultProps} />);
        fireEvent.click(screen.getByText('✕'));
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('habilita confirmar reserva y muestra precio tras seleccionar fechas', async () => {
        render(<ReserveModal {...defaultProps} />);

        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /confirmar reserva/i })).not.toBeDisabled();
        });

        // 4 días × 20 € = 80 €
        expect(screen.getByText(/4 días × 20 €/)).toBeInTheDocument();
        expect(screen.getByText('80 €')).toBeInTheDocument();
    });

    it('carga las fechas bloqueadas al montar', async () => {
        const blocked = [{ start_date: '2026-06-01', end_date: '2026-06-03' }];
        vi.mocked(reservationsLib.reservationsApi.getAvailability).mockResolvedValue(blocked);

        render(<ReserveModal {...defaultProps} />);

        await waitFor(() => {
            expect(reservationsLib.reservationsApi.getAvailability).toHaveBeenCalledWith('listing-1');
        });
    });

    it('muestra error de solapamiento si la reserva falla con 409', async () => {
        vi.mocked(reservationsLib.reservationsApi.reserve).mockRejectedValue(
            new Error('selected dates overlap with an existing reservation')
        );

        render(<ReserveModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /confirmar reserva/i })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /confirmar reserva/i }));

        await waitFor(() => {
            expect(screen.getByText(/overlap/i)).toBeInTheDocument();
        });
    });

    it('llama a onSuccess con el id de transacción tras reserva correcta', async () => {
        vi.mocked(reservationsLib.reservationsApi.reserve).mockResolvedValue({ id: 'tx-1' });

        render(<ReserveModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /confirmar reserva/i })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /confirmar reserva/i }));

        await waitFor(() => {
            expect(defaultProps.onSuccess).toHaveBeenCalledWith('tx-1');
        });
    });
});
