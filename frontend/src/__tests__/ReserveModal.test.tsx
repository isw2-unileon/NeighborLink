import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReserveModal from '../components/ReserveModal';
import * as reservationsLib from '../lib/reservations';

// Mock DayPicker para evitar conflicto de versiones de React
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

    it('el botón continuar está deshabilitado sin fechas seleccionadas', () => {
        render(<ReserveModal {...defaultProps} />);
        expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    });

    it('llama a onClose al pulsar ✕', () => {
        render(<ReserveModal {...defaultProps} />);
        fireEvent.click(screen.getByText('✕'));
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('habilita continuar y muestra precio tras seleccionar fechas', async () => {
        render(<ReserveModal {...defaultProps} />);

        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled();
        });

        // 4 días × 20 € = 80 €
        expect(screen.getByText(/4 días × 20 €/)).toBeInTheDocument();
        expect(screen.getByText('80 €')).toBeInTheDocument();
    });

    it('navega al paso de pago al pulsar continuar', async () => {
        render(<ReserveModal {...defaultProps} />);

        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        expect(screen.getByText('Datos de pago')).toBeInTheDocument();
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
            expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled();
        });
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

        /*)
        // Rellenar tarjeta válida (número Luhn válido)
        fireEvent.change(screen.getByPlaceholderText('1234 5678 9012 3456'), {
            target: { value: '4532015112830366' },
        });
        fireEvent.change(screen.getByPlaceholderText('MM/AA'), {
            target: { value: '12/30' },
        });
        fireEvent.change(screen.getByPlaceholderText('123'), {
            target: { value: '123' },
        });
        */;

        fireEvent.click(screen.getByRole('button', { name: /confirmar reserva/i }));

        await waitFor(() => {
            expect(screen.getByText(/overlap/i)).toBeInTheDocument();
        });
    });

    it('llama a onSuccess tras reserva correcta', async () => {
        vi.mocked(reservationsLib.reservationsApi.reserve).mockResolvedValue({ id: 'tx-1' });

        render(<ReserveModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled();
        });
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

        fireEvent.change(screen.getByPlaceholderText('1234 5678 9012 3456'), {
            target: { value: '4532015112830366' },
        });
        fireEvent.change(screen.getByPlaceholderText('MM/AA'), {
            target: { value: '12/30' },
        });
        fireEvent.change(screen.getByPlaceholderText('123'), {
            target: { value: '123' },
        });

        fireEvent.click(screen.getByRole('button', { name: /confirmar reserva/i }));

        await waitFor(() => {
            expect(defaultProps.onSuccess).toHaveBeenCalled();
        });
    });

    it('vuelve al calendario al pulsar Atrás', async () => {
        render(<ReserveModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Seleccionar rango'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled();
        });
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        expect(screen.getByText('Datos de pago')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /atrás/i }));
        expect(screen.getByText('Elige las fechas')).toBeInTheDocument();
    });
});