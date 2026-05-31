import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import React from 'react';
import PaymentForm, { type PaymentFormHandle } from '../components/PaymentForm';

const mockCreatePaymentMethod = vi.fn();

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn().mockResolvedValue(null),
}));

vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CardNumberElement: () => <div data-testid="card-number" />,
    CardExpiryElement: () => <div data-testid="card-expiry" />,
    CardCvcElement: () => <div data-testid="card-cvc" />,
    useStripe: () => ({ createPaymentMethod: mockCreatePaymentMethod }),
    useElements: () => ({ getElement: vi.fn().mockReturnValue({}) }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

function renderPaymentForm() {
    const ref = createRef<PaymentFormHandle>();
    render(<PaymentForm ref={ref} totalEuros={80} />);
    return ref;
}

describe('PaymentForm.createPaymentMethod', () => {
    it('devuelve el id del PaymentMethod en caso de éxito', async () => {
        mockCreatePaymentMethod.mockResolvedValueOnce({
            paymentMethod: { id: 'pm_test_123' },
            error: undefined,
        });

        const ref = renderPaymentForm();

        let result: string | undefined;
        await act(async () => {
            result = await ref.current!.createPaymentMethod();
        });

        expect(result).toBe('pm_test_123');
    });

    it('lanza el mensaje español para card_declined', async () => {
        mockCreatePaymentMethod.mockResolvedValueOnce({
            paymentMethod: undefined,
            error: { code: 'card_declined', message: 'Your card was declined.' },
        });

        const ref = renderPaymentForm();

        await expect(
            act(async () => {
                await ref.current!.createPaymentMethod();
            })
        ).rejects.toThrow('Tu tarjeta fue rechazada. Por favor, usa otra tarjeta.');
    });

    it('lanza el mensaje español para insufficient_funds', async () => {
        mockCreatePaymentMethod.mockResolvedValueOnce({
            paymentMethod: undefined,
            error: { code: 'insufficient_funds', message: 'Your card has insufficient funds.' },
        });

        const ref = renderPaymentForm();

        await expect(
            act(async () => {
                await ref.current!.createPaymentMethod();
            })
        ).rejects.toThrow('Fondos insuficientes en tu tarjeta.');
    });

    it('cae al message original para códigos desconocidos', async () => {
        mockCreatePaymentMethod.mockResolvedValueOnce({
            paymentMethod: undefined,
            error: { code: 'unknown_code', message: 'Some unexpected error.' },
        });

        const ref = renderPaymentForm();

        await expect(
            act(async () => {
                await ref.current!.createPaymentMethod();
            })
        ).rejects.toThrow('Some unexpected error.');
    });

    it('lanza error de conexión tras 15 segundos de timeout', async () => {
        mockCreatePaymentMethod.mockImplementationOnce(
            () => new Promise(() => { /* never resolves */ })
        );

        const ref = renderPaymentForm();

        const promise = act(async () => {
            await ref.current!.createPaymentMethod();
        });

        await act(async () => {
            vi.advanceTimersByTime(15000);
        });

        await expect(promise).rejects.toThrow('Error de conexión. Comprueba tu red e inténtalo de nuevo.');
    });
});
