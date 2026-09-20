# Cashout, refunds & cancellations

How money moves from a player's card into an organizer's bank account, and
what happens when an event is cancelled or postponed. This is a
documentation pass over existing, working functionality — nothing described
here needed to be built; see the "Playver-branded payout onboarding" section
at the end for the one thing that *was* changed in the same branch as this
doc.

For the account-level pieces (wallet balances, Connect accounts, the 48h
hold) see `ARCHITECTURE.md` §8 first — this doc goes one level deeper into
the actual money-movement code paths.

## 1. The mental model

There is no real-time Stripe transfer between a player and an organizer.
Every payment is a row in `wallet_transaction`, debiting one balance
(`user.walletBalance` or `organization.walletBalance`) and crediting another,
inside a single Postgres transaction (`withTransaction` in `src/lib/db.ts`).
Stripe only enters the picture at the two edges:

- **Money entering the system**: a player's card charge (wallet top-up, or
  the uncovered remainder of an event price) via Stripe Checkout.
- **Money leaving the system**: an organizer's `stripe.transfers.create` call
  to their Connect Express account, followed by Stripe's own payout to their
  bank.

Everything in between — paying for an event, refunding a cancelled one — is
pure ledger arithmetic. This is why refunds can be instant and automatic:
reversing a ledger entry doesn't require Stripe at all.

## 2. How a payment reaches an organizer

`src/app/api/stripe/event-checkout/route.ts` (POST):

1. Computes `getAvailableWalletBalance(userId)` — the player's wallet
   balance minus whatever of it is currently **held** (see §4).
2. `creditCents = min(availableBalance, price)`.
3. If `creditCents === price` (wallet covers it fully): calls
   `payForEventWithWallet(eventId)` immediately. No Stripe involved — this
   is pure ledger transfer, `event.ts:645`.
4. Otherwise: creates a Stripe Checkout session for `price - creditCents`,
   with the wallet portion applied as a **real Stripe coupon** line item (so
   the checkout page itemizes "Event $200.00 − Wallet credit $50.00 = Total
   $150.00" instead of silently showing a smaller number). The wallet isn't
   debited yet at this point — only reserved implicitly by the coupon math.
5. The webhook (`api/stripe/webhook/route.ts` → `completeEventStripePayment`,
   `event.ts:773`) fires once Stripe actually captures the card. It debits
   the wallet-credit portion *now* (best-effort — if the player spent that
   balance elsewhere in the checkout window, the shortfall is tracked but
   never blocks registration, since the card was already charged), and
   credits the organizer the **full price** either way.

Both paths funnel into the same result: `event_payment` row, organizer's
wallet increased by the full price, `event_participant` row inserted. The
organizer is credited the full price on the Stripe-remainder path
specifically so a later cancellation can reverse it the same way as a
pure-wallet payment (§3) — no real Stripe refund call needed.

Which wallet gets credited — `user.walletBalance` or
`organization.walletBalance` — depends on whether `event.organizationId` is
set (org-owned event) or null (legacy personal-organizer event).

Team/tournament payments (`payForTeamWithWallet`, `tournament.ts:992`)
follow the identical wallet-transfer pattern on this branch. The
Stripe-remainder hybrid described above for events is **event-only as of
this branch** — the tournament-side equivalent (`team-checkout` route,
`completeTeamStripePayment`) exists on `staging` /
`feature/team-payment-stripe-checkout` but hasn't been promoted to `main`
yet, per the branch-off-main → merge-to-staging workflow in `README.md`. If
you're reading this after that promotion, team payments should be assumed to
work the same way as event payments above — verify before trusting this
paragraph.

## 3. Refunds — what happens on cancellation

`cancelEvent` (`event.ts:1207`):

1. Flips `event.status` from `'active'` to `'cancelled'` (guarded — a
   double-cancel is a no-op, returns an error instead of running the sweep
   twice).
2. Calls `runEventRefundSweep(eventId)` (`event.ts:1061`) synchronously,
   before responding.
3. Emails every signed-up participant (`sendEventCancelledEmail`), including
   their refund amount if it succeeded.
4. Returns a summary (`refundedCount`, `refundedTotalCents`,
   `pendingReviewCount`) so the organizer-facing UI can show what actually
   happened instead of a bare "cancelled" toast.

**Dashboard UI** (`EventCancelPostponeButton.tsx`): the cancel-confirmation
modal calls `getEventRefundPreview(eventId)` (read-only — same row selection
as the sweep, no mutation) to show "This will refund N participants a total
of $X" *before* the organizer commits. After confirming, a result screen
shows the actual outcome from `cancelEvent`'s return value, including a
manual-review count if any refund needs attention. The organizer sees the
real numbers on both sides of the action, not just a generic confirmation.

`runEventRefundSweep` is the reverse of §2's wallet transfer: for every
still-unrefunded `event_payment` (or `tournament_team_payment` for a
tournament), it debits the organizer's wallet and credits the payer's
personal wallet, the full amount, in one transaction — sorted lock order on
the two `user` rows (or a separate `organization` table for org-owned
events) to avoid deadlocking against a concurrent payment or another
refund. It's gated purely on `refundedAt IS NULL`, not on `event.status`, so
it's safe to call again if a previous run was interrupted partway (a Vercel
function timeout, a DB hiccup) — nothing gets double-refunded, and nothing
gets silently skipped either.

**If a refund fails** (organizer's wallet balance is somehow lower than what
they were paid — shouldn't happen given the 48h hold, but the code doesn't
assume it can't), the payer is added to a `pendingReview` set instead of
being left in limbo, and every super-admin gets an email
(`notifyAdminsOfRefundIssues`) naming the payer and amount. This needs manual
reconciliation — there's no automatic retry.

**Legacy pre-wallet Stripe payments** (`event_payment.method = 'stripe'`,
from before this ledger system existed) are deliberately *not*
auto-refunded — reversing those needs a real `stripe.refunds.create` against
the original charge, a materially different and riskier operation than a
ledger reversal. They're flagged for manual review the same way a failed
refund is.

Refunded money lands back in the **payer's personal wallet**, not their
original card — they can spend it on another event or withdraw it (§5).

### Postponement is not a refund

`postponeEvent` (`event.ts:1254`) just moves `startDateTime`/`endDateTime`
forward and emails everyone (`sendEventPostponedEmail`). No refund sweep
runs, no payment is touched — registrations and payments simply carry over
to the new date. If a player can't make the new date, that's a manual
conversation with the organizer (or Playver support), not an automatic
system path — this matches what the Refund & Cancellation Policy already
tells players (`src/content/legal/refunds.ts`, §3).

### Manual single-participant refund (out-of-organizer's-control incidents)

Not everything that warrants a refund means cancelling the whole event —
an injury, a duplicate signup, a organizer needing to free a seat. For
exactly that, `refundEventParticipant(eventId, userId)` (`event.ts`, next to
`cancelEvent`) refunds and unregisters **one** participant without touching
anyone else's registration or the event's status.

It reuses the same reversal as the bulk sweep — both now call a shared
`reverseWalletPayment()` helper extracted from what used to be
`runEventRefundSweep`'s private closure — targeting exactly one
`event_payment` row instead of every unrefunded one. It also deletes that
participant's `event_participant` row in the same transaction: a refunded
seat shouldn't stay occupied, especially on a capacity-limited event.

- **Gated by `ISSUE_REFUNDS`** (org-owned events) — a permission that
  already existed in `organizer-permissions.ts`'s matrix, unused until now.
  Only `OWNER`/`ADMINISTRATOR` have it by default; `STAFF`/
  `OPERATIONS_MANAGER`/`COACH` don't, so this is intentionally more
  restrictive than `MANAGE_EVENTS` (which gates cancel/postpone). For a
  legacy (no-org) event, it's just the event's creator.
- **Scoped to individual events only, not tournaments** — a tournament
  payment belongs to a team, not a single member, so there's no single
  "this user's payment" to reverse without deciding what happens to the
  rest of their team. Refunding a tournament team today still means
  cancelling the whole tournament (§3). `getEventRegistrants` exposes
  `canIssueRefunds` as `false` whenever `eventType === "Tournament"`, and
  the UI (`RegistrationsClient.tsx`) hides the button accordingly.
- **UI**: `/organizer/registrations` → pick an event → each paid row gets an
  "Issue Refund" button when `canIssueRefunds` is true; clicking it opens an
  inline confirm bar (amount + name) before actually calling the action, and
  the row disappears from the roster once it succeeds (since the person is
  no longer registered).
- The refunded player gets an email (`sendIndividualRefundEmail`) — a
  lighter, single-registration version of the cancellation email, not
  reusing `sendEventCancelledEmail` since the event itself isn't cancelled.

### Disputes/chargebacks

`handlePlatformEvent` in the webhook route listens for
`charge.refunded` and `charge.dispute.created` and emails super-admins to
review manually (`flagPaymentDisputeForReview`) — there's no automated
wallet reversal for these, since the underlying wallet funds may have
already been spent forward into another event by the time a chargeback
lands weeks later.

## 4. Why funds are held for 48 hours (`getHeldBalance`)

`getHeldBalance(organizerId)` / `getOrganizationHeldBalance(organizationId)`
(`wallet.ts:28`, `organizer-wallet.ts:28`) compute, live from
`event_payment`/`tournament_team_payment` joined to the event, how much of
an organizer's balance is currently tied to an event that:

- hasn't ended yet, or ended less than 48 hours ago (`WITHDRAWAL_HOLD_HOURS`), **or**
- was cancelled and still has an unrefunded payment against it.

This is **not** a stored value — it's recomputed on every balance check, so
a postponed event's hold window shifts automatically, and a hold clears the
instant `refundedAt` is set by the refund sweep, with no cron job or
expiring cache to keep in sync.

`getAvailableWalletBalance` (used both to show the discounted event price at
checkout and, authoritatively, to compute wallet credit in
`event-checkout/route.ts`) and `requestWithdrawal`/`requestOrganizationWithdrawal`
both subtract this held amount from the raw balance. Same number, two
purposes: it stops an organizer from both (a) withdrawing money a refund
might need and (b) spending that same held money as wallet credit toward an
unrelated event's price.

**Why it exists at all**: without it, an organizer could collect paid
signups, immediately withdraw everything, then cancel the event — leaving
`runEventRefundSweep` with nothing in their wallet to reverse. The hold
guarantees the money is still sitting there if a cancellation happens, so
the "you're always refunded automatically" promise in the Refund &
Cancellation Policy actually holds up. **Don't shorten or bypass this
without understanding you're reopening that exact fraud path** — flag it
explicitly if a future request asks for that.

## 5. Cashout — the withdrawal flow

`requestWithdrawal` (`wallet.ts:144`) / `requestOrganizationWithdrawal`
(`organizer-wallet.ts:138`):

1. Validates the amount: integer cents, `>= MIN_WITHDRAWAL_CENTS` ($10).
2. Requires a Connect account (`stripeConnectAccountId` set) — if not,
   returns "Connect a payout account first".
3. Checks `walletBalance - heldBalance >= amount` — the pre-check.
4. Re-fetches the Connect account from Stripe and requires
   `payouts_enabled` — catches an account that's been created but hasn't
   finished KYC.
5. Opens a DB transaction: **re-checks held balance again** right before the
   guarded debit (`walletBalance - heldNow >= amount` as a single atomic
   `UPDATE ... WHERE`), so two concurrent withdrawal requests from the same
   organizer can't both slip past step 3's pre-check and jointly overdraw.
   Inserts a `wallet_withdrawal` row (`status = 'processing'`) and a
   `wallet_transaction` row, in the same transaction as the debit.
6. Only *after* that transaction commits does it call
   `stripe.transfers.create`, with the withdrawal's own UUID as the
   idempotency key — so a retried request (network blip, Vercel function
   restart) can't create two transfers for one withdrawal.
7. On success: marks the withdrawal `'completed'` with the Stripe transfer
   id. **On failure**: refunds the debited amount back into the wallet and
   marks the withdrawal `'failed'` with the error message — a withdrawal
   never silently disappears money, it either completes or reverses.

`calculateWithdrawalFee()` always returns `0`, **permanently by design** —
not a placeholder. The plan is for a future organizer commission to be taken
at *payment* time (inside `payForEventWithWallet`/`payForTeamWithWallet`),
specifically to cover Stripe's processing cost. Charging a fee again at
withdrawal would double-charge the same cost, so don't add one here even
after commission ships.

### Playver-branded payout onboarding (changed in this branch)

Before this branch, "Connect a payout account" was a plain redirect
(`stripe.accountLinks.create` → `window.location.href = result.url`) to
Stripe's own hosted onboarding UI at `connect.stripe.com/setup/...` — full
KYC form, Stripe's own look, entirely off Playver's domain. For an organizer
who's never heard of Stripe, that's a jarring, unbranded hop that reads as
"redirected to some other site to hand over my bank details."

This branch replaces that with **Stripe Connect embedded components**
(`@stripe/connect-js` + `@stripe/react-connect-js`): the exact same KYC
requirements (identity, business details, bank account) now render *inline*
on `/dashboard/wallet`, `/organizer/payments`, and the org creation wizard's
Step 9 — restyled to Playver's brand red / Inter font / rounded corners via
Connect.js's `appearance` API — instead of navigating away at all.

- `createConnectAccountSession()` (`wallet.ts`) /
  `createOrganizationConnectAccountSession()` (`organizer-wallet.ts`) replace
  the old `createConnectOnboardingLink`/`createOrganizationConnectOnboardingLink`
  — same "create the Express account if it doesn't exist yet" logic, but
  return a short-lived `client_secret` from `stripe.accountSessions.create`
  instead of a redirect URL.
- `src/components/payments/ConnectPayoutOnboarding.tsx` is the shared
  wrapper (`ConnectComponentsProvider` + `ConnectAccountOnboarding`) used by
  all three call sites, so branding/config lives in exactly one place.
- No more `?connect=return` query-param round trip — there's no redirect to
  return *from*. The panel's `onExit` callback fires when the organizer
  closes or finishes it; the client just calls `router.refresh()` and shows
  the existing "we're verifying your payout account" banner if
  `connectOnboarded` isn't `true` yet (it flips via the existing
  `account.updated` webhook handler, unchanged).
- Account completion status, the Stripe account itself, `payouts_enabled`
  checks, and the whole withdrawal flow above are **completely unchanged** —
  this only replaced how the KYC form is *presented*, not any of the money
  logic.
- The org creation wizard's Step 9 also lost its literal "Powered by
  Stripe" / "Connect with Stripe" copy block — replaced with the same
  neutral "Connect Payout Account" language already used on
  `/organizer/payments` and `/dashboard/wallet`.

**Requires** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (the `pk_test_.../pk_live_...`
paired with `STRIPE_SECRET_KEY`) in `.env.local` / your deployment env — see
`.env.example`. Nothing in the codebase can fetch this value on its own;
it has to come from Stripe Dashboard → Developers → API keys.

## 6. Testing this locally

See `docs/how-to-test-payments.md` for the full click-through checklist —
wallet top-up, both event-payment paths, payout onboarding, withdrawal,
cancel-with-refund-preview, and the manual single-participant refund button
— each with setup/steps/expected-result and which DB rows to check
afterward. That doc is the maintained source for test steps; this doc stays
focused on explaining *why* the code behaves the way it does.
