# How to test: payments, payouts, refunds & cancellations

A click-through checklist for the payment, fee, payout and refund flows. Each scenario has **Setup**, **Steps**, and **Expected result** —
follow them in order the first time, since later ones assume earlier ones
(a paid signup, a connected payout account) already exist.

For *why* each of these works the way it does, see
`docs/cashout-refunds-cancellations.md`. For Stripe test-mode mechanics
(keys, test cards, `stripe listen`), see `docs/stripe-testing.md` — do that
doc's "One-time setup" first, before starting here.

## Before you start

- [ ] `STRIPE_SECRET_KEY` in `.env.local` is `sk_test_...` (never `sk_live_...`).
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set to the matching `pk_test_...` (Stripe Dashboard → Developers → API keys, Test mode on). Restart `npm run dev` after adding it.
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook --forward-connect-to localhost:3000/api/stripe/webhook` is running in its own terminal. The `--forward-connect-to` half matters: `payout.paid`, `payout.failed`, `account.updated` and bank-account changes are *connected-account* events, and without it withdrawals never reach "Deposited".
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

**Expected result**: no Stripe Checkout redirect at all — joins instantly. `event_payment.method = 'wallet'`. For an org event, the org wallet is credited the **net** after fees (see #2b); `event_payment.stripeFeeCents` / `platformFeeCents` / `netCents` are set. Legacy events without an org still credit the organizer's personal wallet the full price, no fees.

## 2b. Fees on a card payment

**Setup**: an org event priced at $200; a player with an empty wallet (or choose "pay full amount by card").

**Steps**: register, pay with `4242 4242 4242 4242`.

**Expected result**:

| | |
|---|---|
| Player charged | $200.00 |
| Stripe processing fee (2.9% + $0.30) | $6.10 |
| Playver fee (5%) | $10.00 |
| **Org wallet credited** | **$183.90** |

`event_payment`: `method = 'stripe_direct'`, `stripeFeeCents = 610`, `platformFeeCents = 1000`, `netCents = 18390`. `wallet_transaction` has an `event_payment_received` row of 18390 with the org's `organizationId`. On `/organizer/payments` the $183.90 shows under **On hold** with an unlock date 48h after the event ends, and the Payment records page shows the same split in the "You receive" column and the payment's detail drawer. The fee math lives in `src/lib/payment-fees.ts` (unit-tested in `payment-fees.test.ts`).

**Tournament teams**: same thing via the captain's "Pay" button. For an org tournament the net goes to the **org** wallet and `tournament_team_payment.organizationId` is set (older rows have it NULL — they were credited to the organizer's personal wallet).

## 3. Paying for an event — partial wallet + card

**Setup**: player's wallet balance is *less* than the event price (but > 0).

**Steps**: join the event, on the Checkout page use `4242 4242 4242 4242`.

**Expected result**: Checkout itemizes "Event $X.XX − Wallet credit −$Y.YY = Total $Z.ZZ" as a real coupon line. After paying, `event_payment.method = 'stripe_direct'`, the org is credited the same net as a full card payment (fees are on the registration price, not on the card portion), player's wallet debited the credit portion (`wallet_transaction` has an `event_payment_sent` row for that amount). Team payments always apply available wallet credit this way.

---

## 4. Payout account onboarding (new: embedded, Playver-branded)

**Setup**: signed in as the organizer (or an org admin), on `/organizer/payments` (also reachable from organizer Settings). Personal wallets no longer have payouts.

**Steps**:
1. Click **Set up payouts**.
2. The KYC form should render **inline**, in Playver red/Inter — confirm the browser URL stays on `localhost:3000` the whole time (no navigation to `connect.stripe.com`).
3. Fill it out with Stripe test values (https://docs.stripe.com/connect/testing — e.g. test SSN `000-00-0000`, test bank routing/account from that page). **Gotcha**: the phone field shows a gray placeholder that looks pre-filled — click in and type a real digit string, or the section silently stays "Incomplete."
4. Submit through to the end.

**Expected result**: panel closes; if Stripe still needs something, the section says so and reopens the form. Check the `stripe listen` terminal for `account.updated`; once Stripe flags `payouts_enabled`, the section shows "Payouts go to {bank} ····1234" and a **Withdraw** button.

**If the panel stays empty or shows an error**: it now shows the reason (e.g. "Stripe: account_invalid", or a missing publishable key) instead of a blank box — fix that before going further.

**Verify in DB**: `organization.stripeConnectAccountId` is set; `stripeConnectOnboarded` flips to `true`. **Verify in Stripe**: the connected account's payout schedule is **manual** (each withdrawal becomes exactly one payout we can track).

---

## 5. Withdrawal (payout to the organizer's bank)

A withdrawal always takes **everything available** (no amount field, no minimum). It's two Stripe steps: a **transfer** from Playver's balance to the org's connected account, then a **payout** from that account to its bank. `src/lib/payouts.ts` runs both, retries safely, and picks up where it left off if interrupted.

**Setup**: continuing from #4, with money that's out of its 48h hold (see "Shortcuts" below to skip the wait) and enough **available** balance on Playver's Stripe test account (see "Shortcuts").

**Steps**: on `/organizer/payments`, click **Withdraw $X**.

**Expected result**:
- Wallet drops to $0 immediately; `wallet_transaction` has one `withdrawal` row (negative).
- Payout history shows **Sending → Arrives by {date} → Deposited** (in test mode it reaches Deposited within seconds).
- `wallet_withdrawal`: `status = 'completed'`, `payoutStatus = 'paid'`, `stripeTransferId` and `stripePayoutId` set, `attempts = 1`, `lastError` NULL.
- `stripe listen` shows `transfer.created`, then `connect payout.paid`, all answered `[200]`.
- In Stripe: the transfer's `transfer_group` and the payout's `metadata.withdrawalId` both equal the `wallet_withdrawal.id`; the org's connected-account balance is back to $0.
- The organizer gets two emails: "Your $X payout is on its way" and "$X deposited in your bank account".

**Try the hold**: with money from an event that hasn't ended 48h ago, the Withdraw button only covers what's available and the page says when the rest unlocks.

**Try "Queued"** (Playver's balance hasn't settled yet): withdraw more than Playver's *available* test balance. The withdrawal shows **Queued**, `lastError` says the balance isn't settled. When Stripe releases the pending money (`balance.available` webhook) or the daily cron runs, it completes by itself.

**Try a bounced deposit**: before withdrawing, change the org's bank (via "Change bank account or payout details") to Stripe's always-failing test account `000111111116`. After withdrawing, `payout.failed` arrives: the withdrawal shows **Update bank account**, the money is back in the wallet, and the organizer gets an email. Change the bank back to `000123456789` — the bank-change webhook retries it automatically and it ends **Deposited**.

**Daily safety net**: `GET /api/cron/payouts` (scheduled in `vercel.json`; needs `Authorization: Bearer $CRON_SECRET` in production, open in dev) retries anything stuck, checks every org wallet against its ledger and recent transfers against Stripe, sends "funds available" emails, and alerts super admins about anything stuck 3+ days. A clean run returns no issues.

---

## 5b. Refund fees (repeat cancellations)

The player always gets the full price back; the org gives back what it received (the net). Playver absorbs the fees until an org passes **2** refunded events or **$100** of absorbed fees in a rolling 90 days (`src/lib/refund-fees.ts`). Refunds go to the player's Playver wallet.

**Steps**: as one org, cancel three paid events (or refund three participants) within 90 days.

**Expected result**:
- Refunds 1–2: org debited only the net; a `refund_fee_absorption` row with `chargedToOrgCents = 0`; the Payments page's refund-fee card counts them.
- Before the 3rd: the cancel dialog warns that the org will be charged the processing fee.
- Refund 3: org also debited the Stripe fee (`chargedToOrgCents > 0`), `organization.refundFeeFlaggedAt` set, super admins emailed once.
- If the org's wallet can't cover that fee, it's recorded as `owedCents` and taken out of the next withdrawal (a `refund_sent` ledger row just before the `withdrawal` row).

---

## 6. Cancel event → automatic bulk refund (new: preview + result summary)

**Setup**: as the organizer, an **active, paid** event with at least one paid signup. Open that event's manage page.

**Steps**:
1. Click **Cancel / Postpone** → **Cancel Event**.
2. Confirm modal should now show an amber box: *"This will refund N participant(s) a total of $X."* before you commit anything.
3. Click **Yes, Cancel Event**.

**Expected result**: a new result screen appears — *"Refunded N participant(s) a total of $X to their wallets"* (or *"No paid registrations needed a refund"* if it was free/empty). If any refund couldn't complete, an amber *"N refund(s) need manual review"* line appears too. Click **Done** to close.

**Verify in DB**: every `event_payment` for that event has `status = 'refunded'` and `refundedAt` set; payers' wallets increased by their paid amount; the org wallet decreased by the **net** it was credited for those payments (plus the processing fee if the org is past its free refunds — see #5b); each signed-up player got a cancellation email (check Resend logs, or your terminal if `EMAIL_MODE=log`).

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
- The org wallet decreased by the net it was credited for that payment (see #5b for when a fee is added); the player's personal wallet increased by the full price.
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
| `event_payment` / `tournament_team_payment` fees | `stripeFeeCents`, `platformFeeCents`, `netCents` (NULL on payments from before fees) |
| `wallet_withdrawal` | `status` (`processing`/`completed`/`failed`), `payoutStatus`, `stripeTransferId`, `stripePayoutId`, `attempts`, `lastError` |
| `refund_fee_absorption` | one row per refund where fees were absorbed or charged; `owedCents` = still to collect |

---

## Shortcuts for local testing

Dev database and Stripe **test mode** only — never run these against staging or prod.

- **Test accounts**: sign up two accounts locally (e.g. `you+organizer@…` and `you+player@…`), create an org as the organizer, and create a paid event under it. Keep the logins in a local, untracked note — never commit them.
- **Skip the 48h hold**: move the event into the past, e.g. `UPDATE event SET "startDateTime" = now() - interval '3 days 6 hours', "endDateTime" = now() - interval '3 days' WHERE id = '<event id>';`
- **Give Playver's test balance available funds**: card payments stay *pending* for a few days even in test mode, so a withdrawal will sit in **Queued**. To make money available immediately, make a test charge with Stripe's `4000 0000 0000 0077` card (or `pm_card_bypassPending` via the API).
- **Test bank accounts** (Canada): transit `11000`, institution `000`, account `000123456789` (pays) or `000111111116` (fails).
- **Cookies**: if you run a second dev server on another port, open it on a different hostname (e.g. `http://e2e.localhost:3100`) so its login doesn't clash with the one on `localhost:3000`.
