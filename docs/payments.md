# Payments: Stripe deposit flow

NeighborLink uses Stripe with **manual capture** to manage deposits. This approach reserves the funds on the borrower's card at the moment of agreement without charging them until physical handover is confirmed. If the deal is cancelled before handover, the reservation is released and the borrower is never charged.

---

## Payment lifecycle

### 1. Deal agreement — `POST /api/transactions`

The borrower accepts the terms and provides their payment method. The backend:

1. Creates a transaction record in `pending` status.
2. Creates a Stripe PaymentIntent with `capture_method: manual`, which places a hold on the borrower's card.
3. Stores the `stripe_payment_intent_id` and `payment_method_id` on the transaction and sets its status to `agreed`.

The money is **reserved but not charged**.

### 2. Handover QR scan — `POST /api/transactions/:id/handover`

The lender scans the borrower's QR code to confirm physical delivery. The backend:

1. Verifies the transaction is in `agreed` status.
2. Captures the PaymentIntent in full — the money leaves the borrower's card.
3. Sets the transaction status to `handed_over`.

### 3. Return QR scan — `POST /api/transactions/:id/return`

The lender scans the return QR code to confirm the item is back. The backend:

1. Verifies the transaction is in `handed_over` status.
2. Refunds **95%** of the deposit to the borrower.
3. The remaining **5%** stays as platform income pending distribution to the lender.
4. Sets the transaction status to `returned`.

---

## State diagram

```
pending ──────────────────────────────────────┐
   │                                           │
   │ POST /api/transactions                    │
   ▼                                           │
agreed ─────────────────────────────────────► cancelled
   │
   │ POST /api/transactions/:id/handover
   ▼
handed_over
   │
   │ POST /api/transactions/:id/return
   ▼
returned
```

Transitions to `cancelled` are allowed from `pending` or `agreed` (before physical handover).

---

## Commission logic

- The **borrower** pays the full deposit amount at handover.
- The **lender** receives 5% of the deposit as an incentive for participating in the platform.
- Currently that 5% is retained as platform income after the refund.
- Distribution of that 5% to the lender via **Stripe Connect** is outside the scope of this task and is pending future implementation.

---

## Configuration

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key. Use `sk_test_...` for development and `sk_live_...` for production. |

> **Never commit this key to the repository.** Add it to your local `.env` file (which is git-ignored) or inject it via your deployment secrets manager.

If `STRIPE_SECRET_KEY` is empty, the Stripe client is initialised without a key and all payment calls will fail with an authentication error. This is acceptable in development when payment endpoints are not exercised.

---

## Security considerations

- All payment endpoints (`POST /transactions`, `POST /transactions/:id/handover`, `POST /transactions/:id/return`) **must be protected with JWT middleware** once authentication is implemented.
- Currently the `borrower_id` is read from the `X-User-ID` header as a temporary development mechanism. When JWT is in place it must be extracted from the token instead.

---

## Future work

- **Stripe Connect**: automatically transfer the lender's 5% share once the return is confirmed, instead of retaining it as platform income.
- **Stripe webhooks**: listen for asynchronous Stripe events (e.g. `payment_intent.succeeded`, `payment_intent.payment_failed`) to handle edge cases such as card failures or disputes.
- **JWT authentication**: protect payment endpoints so only the authenticated borrower can initiate a deal and only the authenticated lender can confirm handover and return.
