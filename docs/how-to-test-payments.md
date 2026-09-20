# How to test: payments, payouts, refunds & cancellations

A click-through checklist for everything on the `payment-and-policies`
branch. Each scenario has **Setup**, **Steps**, and **Expected result** —
follow them in order the first time, since later ones assume earlier ones
(a paid signup, a connected payout account) already exist.

For *why* each of these works the way it does, see
`docs/cashout-refunds-cancellations.md`. For Stripe test-mode mechanics
(keys, test cards, `stripe listen`), see `docs/stripe-testing.md` — do that
doc's "One-time setup" first, before starting here.

## Before you start

- [ ] `STRIPE_SECRET_KEY` in `.env.local` is `sk_test_...` (never `sk_live_...`).
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set to the matching `pk_test_...` (Stripe Dashboard → Developers → API keys, Test mode on). Restart `npm run dev` after adding it.
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` is running in its own terminal.
- [ ] You have (or can create) two accounts: an **organizer** who owns an org with a paid event, and a **player** account to join/pay as.

---

## 1. Wallet top-up

**Setup**: signed in as the player, on `/dashboard/wallet`.

**Steps**:
1. Enter an amount (or click a preset chip), click the top-up button.
2. On the Stripe Checkout page, pay with `4242 4242 4242 4242`, any future expiry, any CVC.

**Expected result**: redirected back to `/dashboard/wallet?deposit=success` with a green success banner; balance increased by exactly the amount paid.

---

## 2. Paying for an event — wallet-only

**Setup**: player's wallet balance ≥ a paid event's price.

**Steps**: open that event, click Join/Register.

**Expected result**: no Stripe Checkout redirect at all — joins instantly. `event_payment.method = 'wallet'`. Organizer's (or org's) wallet balance increased by the full price.

## 3. Paying for an event — partial wallet + card

**Setup**: player's wallet balance is *less* than the event price (but > 0).

**Steps**: join the event, on the Checkout page use `4242 4242 4242 4242`.

**Expected result**: Checkout itemizes "Event $X.XX − Wallet credit −$Y.YY = Total $Z.ZZ" as a real coupon line. After paying, `event_payment.method = 'stripe_direct'`, organizer credited the **full** price, player's wallet debited the credit portion (`wallet_transaction` has an `event_payment_sent` row for that amount).

---

## 4. Payout account onboarding (new: embedded, Playver-branded)

**Setup**: signed in as the organizer (or an org admin), on `/organizer/payments` (same steps apply on `/dashboard/wallet` for a personal wallet, and in the org creation wizard's Step 9).

**Steps**:
1. Click **Connect Payout Account**.
2. The KYC form should render **inline**, in Playver red/Inter — confirm the browser URL stays on `localhost:3000` the whole time (no navigation to `connect.stripe.com`).
3. Fill it out with Stripe test values (https://docs.stripe.com/connect/testing — e.g. test SSN `000-00-0000`, test bank routing/account from that page). **Gotcha**: the phone field shows a gray placeholder that looks pre-filled — click in and type a real digit string, or the section silently stays "Incomplete."
4. Submit through to the end.

**Expected result**: panel closes; if not yet fully verified, an amber "we're verifying your payout account" banner shows. Check the `stripe listen` terminal for `account.updated`; once Stripe flags `payouts_enabled`, reloading the page shows the withdrawal form instead of the connect button.

**Verify in DB**: `organization.stripeConnectAccountId` (or `user.stripeConnectAccountId` for a personal wallet) is set; `stripeConnectOnboarded` flips to `true`.

---

## 5. Withdrawal (cashout)

**Setup**: continuing from #4, with a wallet balance ≥ $10 that isn't held (see #7 for the hold).

**Steps**: enter an amount ≥ $10 (up to the shown "available to withdraw"), submit.

**Expected result**: success message, balance drops immediately. `wallet_withdrawal` row `status = 'completed'` with a `stripeTransferId`. `wallet_transaction` has a `withdrawal` row (negative amount).

**Try the hold**: attempt to withdraw an amount that includes money from an event ending in the future — should be rejected with "Some of your balance is held until 48 hours after your event ends."

---

## 6. Cancel event → automatic bulk refund (new: preview + result summary)

**Setup**: as the organizer, an **active, paid** event with at least one paid signup. Open that event's manage page.

**Steps**:
1. Click **Cancel / Postpone** → **Cancel Event**.
2. Confirm modal should now show an amber box: *"This will refund N participant(s) a total of $X."* before you commit anything.
3. Click **Yes, Cancel Event**.

**Expected result**: a new result screen appears — *"Refunded N participant(s) a total of $X to their wallets"* (or *"No paid registrations needed a refund"* if it was free/empty). If any refund couldn't complete, an amber *"N refund(s) need manual review"* line appears too. Click **Done** to close.

**Verify in DB**: every `event_payment` for that event has `status = 'refunded'` and `refundedAt` set; payers' wallets increased by their paid amount; organizer's wallet decreased by the same total; each signed-up player got a cancellation email (check Resend logs, or your terminal if `EMAIL_MODE=log`).

**Postponement, for contrast**: use **Postpone** instead — dates change, nobody is refunded, no result screen (there's nothing to report), everyone gets a "postponed" email.

---

## 7. Manual single-participant refund (new)

This is for the "something happened out of the organizer's control" case — one player needs refunding and removed from a *still-active* event, without cancelling it for everyone else.

**Setup**: as the organizer, go to `/organizer/registrations`, select a **non-tournament** paid event with at least one paid registrant. (Tournament team payments aren't covered by this button — cancel the tournament instead to refund a team, per #6.) You need the `ISSUE_REFUNDS` permission — OWNER/ADMINISTRATOR roles have it by default; STAFF/OPERATIONS_MANAGER/COACH don't, so the button won't appear for them.

**Steps**:
1. Find the paid registrant's row — a red outlined **Issue Refund** button should appear next to Contact.
2. Click it — an inline confirmation bar appears: *"Refund $X.XX to [name] and remove them from this event?"*
3. Click **Confirm Refund**.

**Expected result**: button row shows "Refunding…" briefly, then the registrant **disappears from the list entirely** (they're unregistered). The event's paid-participant count drops by one, freeing a capacity slot if the event has one.

**Verify in DB**:
- That participant's `event_payment.status = 'refunded'`, `refundedAt` set.
- `event_participant` row for them on this event is gone.
- Organizer's (or org's) wallet decreased by the refunded amount; the player's personal wallet increased by the same amount.
- `wallet_transaction`: a `refund_sent` row (organizer/org) and a `refund_received` row (player), both tagged with this `eventId`.
- The player received a "You've been refunded" email.

**Try it twice**: refunding the same already-refunded person again should fail with "No refundable payment found for this participant" — it can't double-refund.

**Try as the wrong role**: sign in as a STAFF/OPERATIONS_MANAGER org member — the Issue Refund button shouldn't render at all for them.

---

## 8. Disputes / chargebacks (manual-review path, no self-serve UI)

Not testable end-to-end without a real card dispute. To sanity-check the wiring: in the Stripe Dashboard (test mode), trigger a test dispute against a past test charge, or use `stripe trigger charge.dispute.created` via the CLI. Confirm `stripe listen` shows the event and every `super_admin`-role user gets a "payment dispute needs review" email.

---

## Quick reference: what to look at after any test

| Table | What changed |
|---|---|
| `user.walletBalance` / `organization.walletBalance` | balances after any payment/refund/withdrawal |
| `event_payment` / `tournament_team_payment` | `status`, `refundedAt` |
| `event_participant` | present = registered; gone = refunded-and-removed (or left) |
| `wallet_transaction` | the full audit trail — every balance change has a row here, filterable by `eventId`/`teamId`/`withdrawalId` |
| `wallet_withdrawal` | `status` (`processing`/`completed`/`failed`) + `stripeTransferId` |
