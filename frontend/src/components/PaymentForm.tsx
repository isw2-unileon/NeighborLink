import { forwardRef, useImperativeHandle, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

export interface PaymentFormHandle {
    createPaymentMethod(): Promise<string>;
}

interface Props {
    totalEuros: number;
}

const ELEMENT_STYLE = {
    base: {
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '14px',
        color: '#1d1b16',
        '::placeholder': { color: '#9b8e82' },
    },
};

interface FieldErrors {
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
}

const PaymentFormInner = forwardRef<PaymentFormHandle, Props>(({ totalEuros }, ref) => {
    const stripe = useStripe();
    const elements = useElements();
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    useImperativeHandle(ref, () => ({
        async createPaymentMethod(): Promise<string> {
            if (!stripe || !elements) throw new Error('Stripe no está disponible.');

            const cardElement = elements.getElement(CardNumberElement);
            if (!cardElement) throw new Error('Stripe no está disponible.');

            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (error) throw new Error(error.message);
            return paymentMethod!.id;
        },
    }));

    const elementClass =
        'mt-1 block w-full border border-[var(--border)] rounded-2xl p-2.5 focus-within:ring-2 focus-within:ring-[var(--ring)]';

    return (
        <div className="space-y-4">
            <label className="block">
                <span className="text-sm font-medium text-[var(--muted)]">Número de tarjeta</span>
                <div className={elementClass}>
                    <CardNumberElement
                        options={{ style: ELEMENT_STYLE }}
                        onChange={e =>
                            setFieldErrors(prev => ({
                                ...prev,
                                cardNumber: e.error?.message,
                            }))
                        }
                    />
                </div>
                {fieldErrors.cardNumber && (
                    <p className="text-red-600 text-xs mt-1">{fieldErrors.cardNumber}</p>
                )}
            </label>

            <div className="flex gap-3">
                <label className="block flex-1">
                    <span className="text-sm font-medium text-[var(--muted)]">Caducidad</span>
                    <div className={elementClass}>
                        <CardExpiryElement
                            options={{ style: ELEMENT_STYLE }}
                            onChange={e =>
                                setFieldErrors(prev => ({
                                    ...prev,
                                    expiry: e.error?.message,
                                }))
                            }
                        />
                    </div>
                    {fieldErrors.expiry && (
                        <p className="text-red-600 text-xs mt-1">{fieldErrors.expiry}</p>
                    )}
                </label>

                <label className="block w-28">
                    <span className="text-sm font-medium text-[var(--muted)]">CVV</span>
                    <div className={elementClass}>
                        <CardCvcElement
                            options={{ style: ELEMENT_STYLE }}
                            onChange={e =>
                                setFieldErrors(prev => ({
                                    ...prev,
                                    cvc: e.error?.message,
                                }))
                            }
                        />
                    </div>
                    {fieldErrors.cvc && (
                        <p className="text-red-600 text-xs mt-1">{fieldErrors.cvc}</p>
                    )}
                </label>
            </div>

            <div className="p-3 bg-[var(--surface-strong)] rounded-2xl text-sm">
                <div className="flex justify-between font-semibold">
                    <span>Total a pagar</span>
                    <span>{totalEuros} €</span>
                </div>
                <p className="text-[var(--muted)] text-xs mt-1">
                    El depósito se bloqueará en tu tarjeta hasta la devolución.
                </p>
            </div>
        </div>
    );
});

PaymentFormInner.displayName = 'PaymentFormInner';

const PaymentForm = forwardRef<PaymentFormHandle, Props>((props, ref) => (
    <Elements stripe={stripePromise}>
        <PaymentFormInner {...props} ref={ref} />
    </Elements>
));

PaymentForm.displayName = 'PaymentForm';

export default PaymentForm;
