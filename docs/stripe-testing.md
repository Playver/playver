# Testing Stripe payments locally

See `docs/cashout-refunds-cancellations.md` for how the payment, cashout,
and refund/cancellation flows actually work end to end — this doc is just
the local test-setup mechanics.

## One-time setup

1. In `.env.local`, `STRIPE_SECRET_KEY` must be a **test** key (`sk_test_...`), never `sk_live_...`. Get it from the [Stripe Dashboard](https://dashboard.stripe.com) with the "Test mode" toggle on (top right), under Developers → API keys.
2. Also set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the matching `pk_test_...` key from the same API keys page — required for the embedded Connect onboarding UI (`ConnectPayoutOnboarding`) on `/dashboard/wallet`, `/organizer/payments`, and the org creation wizard. Restart the dev server after setting it (it's a `NEXT_PUBLIC_` var, inlined at build time).
3. Authenticate the Stripe CLI once: `stripe login`
4. Every time you test, run this in a terminal and leave it running — it forwards Stripe's test-mode webhook events to your local server:
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   It prints `Your webhook signing secret is whsec_...` — put that value in `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart the dev server.

You'll know you're in test mode (not live) if the Stripe Checkout page shows a **"Sandbox"** badge next to the merchant name, and the URL contains `checkout.stripe.com/c/pay/cs_test_...` (not `cs_live_...`).

## Test card numbers

Use any future expiry date (e.g. `12/34`), any 3-digit CVC (4 digits for Amex), and any postal code — Stripe ignores them in test mode.

| Card number | Behavior |
|---|---|
| `4242 4242 4242 4242` | Succeeds — standard Visa test card, use this for the happy path |
| `4000 0000 0000 0002` | Card declined (generic decline) |
| `4000 0000 0000 9995` | Card declined — insufficient funds |
| `4000 0027 6000 3184` | Requires 3D Secure authentication (test the auth modal) |
| `4000 0000 0000 0069` | Expired card decline |
| `4000 0000 0000 0127` | Incorrect CVC decline |

Full reference (more cards, international, wallets): https://docs.stripe.com/testing

## Sanity checks after a test payment

- `stripe listen` terminal should show `checkout.session.completed --> ... <-- [200]`.
- `event_payment` table: new row, `method = 'stripe_direct'`, `status = 'completed'`.
- `event_participant` table: new row for the payer.
- Organizer's `user.walletBalance` increased by the full event price.
- `wallet_transaction` table: `event_payment_received` row for the organizer (and `event_payment_sent` for the payer if wallet credit was applied).

## Organization wallet

For events owned by an organization (`event.organizationId` set), money credits/debits the **organization's** wallet, not the individual creator's personal wallet — see `organizer-wallet.ts`. The checks below are the org-scoped equivalents of the personal-wallet checks above; run them against an org-owned paid event.

- After a Stripe-direct or wallet-funded join: `organization.walletBalance` (not any `user.walletBalance`) increased by the full price. `wallet_transaction` row has `organizationId` set and `userId` **null** for the `event_payment_received` leg.
- `/organizer/payments` reflects the same balance, plus the held-balance note (`$X held until 48 hours after your event(s) end`) when applicable — computed by `getOrganizationHeldBalance`, a separate function from the personal `getHeldBalance` (never modify `getHeldBalance` itself; it's the anti-fraud logic for personal wallets).
- Cancelling the event: `organization.walletBalance` swept back toward zero, payer's **personal** wallet credited back the refund. `wallet_transaction` legs split as `refund_sent` (`organizationId` set) / `refund_received` (`userId` set).
- Held-balance expiry: backdate the event's `endDateTime` more than 48h into the past (`UPDATE "event" SET "endDateTime" = NOW() - INTERVAL '3 days' WHERE id = '...'`) and refresh `/organizer/payments` — the held note should disappear once the balance clears the hold window.

### Org-level Stripe Connect (payouts)

The org creation wizard's "Connect Payout Account" step, and the same button on `/organizer/payments`, both onboard an **organization-level** Express account (`organization.stripeConnectAccountId`) — separate from any individual member's personal Connect account. Verify this didn't regress by checking `organization.stripeConnectAccountId` is set and no `user` row shares that same account id.

Onboarding renders **inline** via Stripe Connect embedded components (`ConnectPayoutOnboarding`, `@stripe/connect-js`) — not a redirect to `connect.stripe.com` anymore. It's the same underlying KYC form and Express account either way, so everything below still applies unchanged.

**Gotcha**: the phone number field on Stripe's onboarding form shows a light-gray sample number (`+1 506 234 5678`) that looks pre-filled but is actually just a placeholder — if you don't click in and type a real digit string, Stripe silently keeps `individual.phone` unset and the whole "Personal details" section stays stuck on "Incomplete" with no visible error. If onboarding won't submit, check the account's real requirements directly instead of guessing from the UI:
```
STRIPE_KEY=$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2-)
curl -s https://api.stripe.com/v1/accounts/acct_XXXXX -u "$STRIPE_KEY:" | python3 -m json.tool
```
`requirements.currently_due` names the exact missing field.

After a full submission, `account.updated` fires (visible in the `stripe listen` log as `connect account.updated`). The webhook (`handleConnectAccountEvent`) tries the `user` table first, then falls back to `organization` — confirm `organization.stripeConnectOnboarded` flips based on the account's real `details_submitted && payouts_enabled` state (Stripe's test-mode identity verification can keep `payouts_enabled` false even after a full submission — that's Stripe's own test-mode behavior, not a bug in the webhook).
