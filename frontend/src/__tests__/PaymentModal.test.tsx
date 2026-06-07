import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PaymentModal from '../components/PaymentModal';

// Stripe mocks (PaymentForm imports these)
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn().mockResolvedValue(null) }));
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CardNumberElement: () => <div data-testid="card-number" />,
    CardExpiryElement: () => <div data-testid="card-expiry" />,
    CardCvcElement: () => <div data-testid="card-cvc" />,
    useStripe: () => ({
        createPaymentMethod: vi.fn().mockResolvedValue({ paymentMethod: { id: 'pm_123' }, error: undefined }),
        handleNextAction: vi.fn().mockResolvedValue({}),
        retrievePaymentIntent: vi.fn().mockResolvedValue({ paymentIntent: { status: 'succeeded' } }),
    }),
    useElements: () => ({ getElement: vi.fn().mockReturnValue({}) }),
}));

vi.mock('../lib/transactions', () => ({
    transactionsApi: {
        pay: vi.fn().mockResolvedValue({ clientSecret: '' }),
    },
}));

import { transactionsApi } from '../lib/transactions';

const baseProps = {
    transactionId: 'tx-1',
    depositAmount: 50,
    startDate: '2026-06-10',
    endDate: '2026-06-11',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
};

// totalCents = 1 day * 50€ * 100 + 200 = 5200

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PaymentModal — selector de método de pago', () => {
    it('muestra el selector de método de pago al abrir', () => {
        render(<PaymentModal {...baseProps} userPoints={6000} />);
        expect(screen.getByText('Método de pago')).toBeDefined();
        expect(screen.getByText('Pagar con tarjeta')).toBeDefined();
    });

    it('muestra la opción de puntos cuando el saldo es suficiente', () => {
        render(<PaymentModal {...baseProps} userPoints={5200} />);
        expect(screen.getByText('Pagar con puntos')).toBeDefined();
    });

    it('NO muestra la opción de puntos cuando el saldo es insuficiente', () => {
        render(<PaymentModal {...baseProps} userPoints={5199} />);
        expect(screen.queryByText('Pagar con puntos')).toBeNull();
    });

    it('NO muestra la opción de puntos con saldo 0', () => {
        render(<PaymentModal {...baseProps} userPoints={0} />);
        expect(screen.queryByText('Pagar con puntos')).toBeNull();
    });

    it('navega a la vista de tarjeta al seleccionar "Pagar con tarjeta"', () => {
        render(<PaymentModal {...baseProps} userPoints={6000} />);
        fireEvent.click(screen.getByText('Pagar con tarjeta'));
        expect(screen.getByText('Datos de pago')).toBeDefined();
    });

    it('navega a la vista de puntos al seleccionar "Pagar con puntos"', () => {
        render(<PaymentModal {...baseProps} userPoints={6000} />);
        fireEvent.click(screen.getByText('Pagar con puntos'));
        expect(screen.getByText('Pagar con puntos', { selector: 'h2' })).toBeDefined();
    });

    it('vuelve al selector al pulsar la flecha de retroceso', () => {
        render(<PaymentModal {...baseProps} userPoints={6000} />);
        fireEvent.click(screen.getByText('Pagar con tarjeta'));
        fireEvent.click(screen.getByLabelText('Volver'));
        expect(screen.getByText('Método de pago')).toBeDefined();
    });
});

describe('PaymentModal — pago con puntos', () => {
    it('muestra el coste y saldo en la vista de puntos', () => {
        render(<PaymentModal {...baseProps} userPoints={6000} />);
        fireEvent.click(screen.getByText('Pagar con puntos'));
        // 5200 cents = 52.00 pts; remaining = 6000 - 5200 = 800 cents = 8.00 pts
        expect(screen.getByText('60.00 pts')).toBeDefined(); // saldo actual
        expect(screen.getByText('−52.00 pts')).toBeDefined(); // coste
        expect(screen.getByText('8.00 pts')).toBeDefined();   // saldo tras pago
    });

    it('llama a transactionsApi.pay con payment_method=points al confirmar', async () => {
        const onSuccess = vi.fn();
        render(<PaymentModal {...baseProps} userPoints={6000} onSuccess={onSuccess} />);
        fireEvent.click(screen.getByText('Pagar con puntos'));
        fireEvent.click(screen.getByText('Confirmar pago'));

        await waitFor(() => expect(transactionsApi.pay).toHaveBeenCalledWith(
            'tx-1',
            5000, // depositCents
            null,
            'points',
        ));
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });

    it('llama a onPointsDeducted con el total en cents tras el pago', async () => {
        const onPointsDeducted = vi.fn();
        render(<PaymentModal {...baseProps} userPoints={6000} onPointsDeducted={onPointsDeducted} />);
        fireEvent.click(screen.getByText('Pagar con puntos'));
        fireEvent.click(screen.getByText('Confirmar pago'));

        await waitFor(() => expect(onPointsDeducted).toHaveBeenCalledWith(5200)); // depositCents+200
    });
});
