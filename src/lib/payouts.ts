// Organization payouts: wallet -> Playver's Stripe balance -> the org's
// connected Stripe account (transfer) -> the org's bank (payout).
//
// A withdrawal is one wallet_withdrawal row moved forward by
// advanceWithdrawal(), an idempotent step function that picks up wherever
// the row is. It's called right after the organizer clicks Withdraw, and
// again by every retry trigger — Stripe webhooks (payout.*, account.updated,
// balance.available), the daily payouts cron, and the Earnings page load —
// so nothing is ever left half-done:
//
//   status 'processing', no transfer   -> stripe.transfers.create
//   status 'processing', transfer, no payout -> stripe.payouts.create
//   payoutStatus 'pending'/'in_transit'      -> wait for payout.paid
//   payout.paid                              -> status 'completed'
//   payout.failed                            -> payoutStatus 'failed'; money
//       sits safely in the org's Stripe balance; retried once the bank
//       account changes (or the organizer clicks Retry)
//
// Only a transfer Stripe rejects outright (not a temporary condition) ends a
// withdrawal as 'failed', and that always puts the money back in the wallet.
//
// Every Stripe call uses an idempotency key derived from the withdrawal id,
// so concurrent triggers can never move money twice.
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import type { PoolClient } from "@neondatabase/serverless";
import { pool, withTransaction } from "@/lib/db";
import { resend, FROM, layout } from "@/lib/emails/_shared";
import { sendPayoutNeedsActionEmail, sendWithdrawalDepositedEmail, sendWithdrawalSentEmail } from "@/lib/emails/payouts";

export type PayoutReadiness =
  | { state: "not_started" }
  | { state: "needs_info"; currentlyDue: string[]; disabledReason: string | null }
  | { state: "ready"; bankName: string | null; last4: string | null; manualPayouts: boolean };

export function readinessFromAccount(account: Stripe.Account): PayoutReadiness {
  const due = [...(account.requirements?.currently_due ?? []), ...(account.requirements?.past_due ?? [])];
  const transfersActive = account.capabilities?.transfers === "active";
  if (!account.payouts_enabled || !transfersActive || due.length > 0) {
    return { state: "needs_info", currentlyDue: [...new Set(due)], disabledReason: account.requirements?.disabled_reason ?? null };
  }
  const bank = account.external_accounts?.data.find((b) => b.object === "bank_account" && b.default_for_currency) as
    | Stripe.BankAccount
    | undefined;
  return {
    state: "ready",
    bankName: bank?.bank_name ?? null,
    last4: bank?.last4 ?? null,
    manualPayouts: account.settings?.payouts?.schedule?.interval === "manual",
  };
}

// Accounts Playver controls get a manual payout schedule so each withdrawal
// becomes exactly one trackable payout. Legacy Express accounts can't be
// changed this way and keep Stripe's automatic daily payouts.
export async function ensureManualPayouts(account: Stripe.Account): Promise<Stripe.Account> {
  const platformCollected = account.controller?.requirement_collection === "application";
  if (!platformCollected || account.settings?.payouts?.schedule?.interval === "manual") return account;
  return stripe.accounts.update(account.id, { settings: { payouts: { schedule: { interval: "manual" } } } });
}

// Temporary conditions worth retrying rather than failing the withdrawal.
function isRetryable(e: unknown): boolean {
  if (e instanceof Stripe.errors.StripeError) {
    if (e.code === "balance_insufficient") return true;
    return (
      e.type === "StripeConnectionError" ||
      e.type === "StripeAPIError" ||
      e.type === "StripeRateLimitError" ||
      (e.statusCode !== undefined && e.statusCode >= 500)
    );
  }
  return true; // unknown/network errors: safer to retry than to give up
}

// What's stored in lastError/failureReason is shown to organizers, so it's
// a safe summary — Stripe's raw messages can quote (masked) keys and ids.
// The full error always goes to the server log.
function errorMessage(e: unknown) {
  console.error("[payouts] Stripe call failed", e);
  if (e instanceof Stripe.errors.StripeError) {
    if (e.code === "balance_insufficient") {
      return "Waiting for recent payments to settle in Playver's Stripe balance — sent automatically once they do";
    }
    return `Stripe couldn't complete this step (${e.code ?? e.type}) — retrying automatically`;
  }
  return "Temporary error — retrying automatically";
}

type WithdrawalRow = {
  id: string;
  organizationId: string;
  amount: string | number;
  attempts: number;
  stripeTransferId: string | null;
  stripePayoutId: string | null;
  payoutStatus: string | null;
};

export type AdvanceResult = "payout_sent" | "queued" | "failed" | "waiting" | "done" | "noop";

type AfterCommit = () => Promise<void>;

// Holds a row lock on the withdrawal for the whole step (SKIP LOCKED: a
// concurrent trigger just backs off), so only one process ever talks to
// Stripe about a given withdrawal at a time. Before creating anything it
// looks for an existing transfer/payout tagged with this withdrawal — that
// covers a previous attempt whose outcome was unknown (timeout) — and only
// then creates one with a fresh per-attempt idempotency key. (Reusing one
// fixed key would make Stripe replay a cached "balance not settled yet"
// error for 24h instead of retrying.)
export async function advanceWithdrawal(withdrawalId: string): Promise<AdvanceResult> {
  const afterCommit: AfterCommit[] = [];
  const result = await withTransaction(async (client): Promise<AdvanceResult> => {
    const res = await client.query(
      `SELECT id, "organizationId", amount, attempts, "stripeTransferId", "stripePayoutId", "payoutStatus"
       FROM "wallet_withdrawal"
       WHERE id = $1 AND "organizationId" IS NOT NULL AND status = 'processing'
       FOR UPDATE SKIP LOCKED`,
      [withdrawalId]
    );
    const w = res.rows[0] as WithdrawalRow | undefined;
    if (!w) return "noop";
    await client.query(`UPDATE "wallet_withdrawal" SET attempts = attempts + 1, "lastAttemptAt" = NOW() WHERE id = $1`, [w.id]);
    const attempt = Number(w.attempts) + 1;
    const amountCents = Number(w.amount);

    const orgRow = await client.query(`SELECT "stripeConnectAccountId" FROM "organization" WHERE id = $1`, [w.organizationId]);
    const accountId = orgRow.rows[0]?.stripeConnectAccountId as string | null;
    if (!accountId && !w.stripeTransferId) {
      afterCommit.push(await failWithdrawal(client, w, "No payout account connected"));
      return "failed";
    }

    // 1. Transfer: Playver's Stripe balance -> the org's Stripe account.
    if (!w.stripeTransferId) {
      try {
        const existing = await stripe.transfers.list({ transfer_group: w.id, limit: 1 });
        const transfer =
          existing.data[0] ??
          (await stripe.transfers.create(
            {
              amount: amountCents,
              currency: "cad",
              destination: accountId!,
              transfer_group: w.id,
              metadata: { withdrawalId: w.id, organizationId: w.organizationId },
            },
            { idempotencyKey: `${w.id}-transfer-${attempt}` }
          ));
        await client.query(`UPDATE "wallet_withdrawal" SET "stripeTransferId" = $1, "lastError" = NULL WHERE id = $2`, [
          transfer.id,
          w.id,
        ]);
        w.stripeTransferId = transfer.id;
      } catch (e) {
        if (isRetryable(e)) {
          await client.query(`UPDATE "wallet_withdrawal" SET "lastError" = $1 WHERE id = $2`, [errorMessage(e), w.id]);
          return "queued";
        }
        afterCommit.push(await failWithdrawal(client, w, errorMessage(e)));
        return "failed";
      }
    }

    // 2. Payout: the org's Stripe account -> their bank.
    if (w.payoutStatus === "paid") return "done";
    if (w.payoutStatus === "pending" || w.payoutStatus === "in_transit") return "waiting";

    try {
      let account: Stripe.Account = await stripe.accounts.retrieve(accountId!);
      account = await ensureManualPayouts(account);
      if (account.settings?.payouts?.schedule?.interval !== "manual") {
        // Legacy automatic-payout account: Stripe sweeps it to the bank on
        // its own schedule; our part is done once the transfer landed.
        await client.query(
          `UPDATE "wallet_withdrawal" SET status = 'completed', "payoutStatus" = 'automatic', "lastError" = NULL WHERE id = $1`,
          [w.id]
        );
        return "done";
      }

      const recent = await stripe.payouts.list({ limit: 20 }, { stripeAccount: accountId! });
      const payout =
        recent.data.find(
          (p) => p.metadata?.withdrawalId === w.id && p.id !== w.stripePayoutId && p.status !== "failed" && p.status !== "canceled"
        ) ??
        (await stripe.payouts.create(
          { amount: amountCents, currency: "cad", metadata: { withdrawalId: w.id } },
          { stripeAccount: accountId!, idempotencyKey: `${w.id}-payout-${attempt}` }
        ));
      await client.query(
        `UPDATE "wallet_withdrawal" SET "stripePayoutId" = $1, "payoutStatus" = $2, "payoutArrivalDate" = to_timestamp($3), "lastError" = NULL
         WHERE id = $4`,
        [payout.id, payout.status === "paid" ? "paid" : "in_transit", payout.arrival_date, w.id]
      );
      if (payout.status === "paid") {
        await client.query(`UPDATE "wallet_withdrawal" SET status = 'completed' WHERE id = $1`, [w.id]);
        afterCommit.push(() => sendWithdrawalDepositedEmail(w.organizationId, amountCents));
      } else {
        afterCommit.push(async () => {
          // The payout.paid webhook can beat this email (instant test-mode
          // payouts); don't announce "on its way" after "deposited".
          const now = await pool.query(`SELECT status FROM "wallet_withdrawal" WHERE id = $1`, [w.id]);
          if (now.rows[0]?.status === "processing") {
            await sendWithdrawalSentEmail(w.organizationId, amountCents, new Date(payout.arrival_date * 1000));
          }
        });
      }
      return "payout_sent";
    } catch (e) {
      // The money already left Playver — it's in the org's own Stripe
      // balance and stays there until a payout succeeds. Never reverse the
      // wallet here.
      await client.query(`UPDATE "wallet_withdrawal" SET "payoutStatus" = 'blocked', "lastError" = $1 WHERE id = $2`, [
        errorMessage(e),
        w.id,
      ]);
      if (!isRetryable(e) && w.payoutStatus !== "blocked") {
        afterCommit.push(() =>
          sendPayoutNeedsActionEmail(w.organizationId, amountCents, "Stripe couldn't send it to your bank account.")
        );
      }
      return "queued";
    }
  });
  for (const fn of afterCommit) await fn().catch((e) => console.error("[advanceWithdrawal] after-commit", e));
  return result;
}

// Only for a transfer Stripe refused outright — money never left Playver, so
// it goes straight back into the org wallet, visibly, with admins alerted.
async function failWithdrawal(client: PoolClient, w: WithdrawalRow, reason: string): Promise<AfterCommit> {
  const amountCents = Number(w.amount);
  await client.query(`UPDATE "wallet_withdrawal" SET status = 'failed', "failureReason" = $1, "lastError" = $1 WHERE id = $2`, [
    reason,
    w.id,
  ]);
  const bal = await client.query(
    `UPDATE "organization" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2 RETURNING "walletBalance"`,
    [amountCents, w.organizationId]
  );
  await client.query(
    `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "withdrawalId")
     VALUES ($1, $2, 'withdrawal', $3, $4, $5)`,
    [crypto.randomUUID(), w.organizationId, amountCents, bal.rows[0].walletBalance, w.id]
  );
  return () =>
    alertAdmins(
      "Organizer withdrawal failed",
      `Withdrawal ${w.id} (org ${w.organizationId}, ${(amountCents / 100).toFixed(2)} CAD) was refused by Stripe and returned to the org wallet. Reason: ${reason}`
    );
}

// payout.paid. Keyed on the payout id (not just the withdrawal) so a stale
// "paid" for an earlier, since-replaced payout can't complete a retry, and a
// failure that already arrived is never overwritten by a late "paid".
export async function markDeposited(payout: Pick<Stripe.Payout, "id" | "metadata">) {
  const withdrawalId = payout.metadata?.withdrawalId;
  if (!withdrawalId) return;
  const res = await pool.query(
    `UPDATE "wallet_withdrawal" SET status = 'completed', "payoutStatus" = 'paid', "lastError" = NULL
     WHERE id = $1 AND "stripePayoutId" = $2 AND status = 'processing' AND "payoutStatus" IS DISTINCT FROM 'failed'
     RETURNING "organizationId", amount`,
    [withdrawalId, payout.id]
  );
  const row = res.rows[0];
  if (row) {
    sendWithdrawalDepositedEmail(row.organizationId, Number(row.amount)).catch(() => {});
    return;
  }
  // No match. Either this "paid" belongs to a payout we just created but
  // haven't recorded yet (Stripe can report it before payouts.create's
  // transaction commits) — throw so the webhook 500s and Stripe redelivers
  // in a few minutes — or it's stale/already handled, which is a no-op.
  const current = await pool.query(
    `SELECT status, "stripePayoutId" FROM "wallet_withdrawal" WHERE id = $1`,
    [withdrawalId]
  );
  const w = current.rows[0];
  if (w?.status === "processing" && w.stripePayoutId !== payout.id) {
    const org = await pool.query(
      `SELECT o."stripeConnectAccountId" FROM "wallet_withdrawal" ww JOIN "organization" o ON o.id = ww."organizationId" WHERE ww.id = $1`,
      [withdrawalId]
    );
    const live = await stripe.payouts.retrieve(payout.id, {}, { stripeAccount: org.rows[0]?.stripeConnectAccountId });
    if (live.status === "paid") throw new Error(`payout ${payout.id} paid before it was recorded on withdrawal ${withdrawalId}; retry`);
  }
}

// payout.failed: the bank rejected or returned the deposit and Stripe put
// the money back in the org's Stripe balance. Banks can return a deposit
// days AFTER Stripe reported it paid, so this reopens a 'completed'
// withdrawal too — the organizer is told to fix their bank, and it's retried.
export async function markPayoutFailed(payout: Stripe.Payout) {
  const res = await pool.query(
    `UPDATE "wallet_withdrawal" SET status = 'processing', "payoutStatus" = 'failed', "lastError" = $1
     WHERE "stripePayoutId" = $2 AND status IN ('processing', 'completed') AND "payoutStatus" IS DISTINCT FROM 'failed'
     RETURNING "organizationId", amount`,
    [payout.failure_message ?? payout.failure_code ?? "The bank rejected the deposit", payout.id]
  );
  const row = res.rows[0];
  if (row) {
    sendPayoutNeedsActionEmail(
      row.organizationId,
      Number(row.amount),
      payout.failure_message ? `Their reason: "${payout.failure_message}".` : "The bank rejected the deposit."
    ).catch(() => {});
  }
}

// Retry everything still open for an org (after a bank update, a Retry
// click, or a page visit). A failed payout is only retried automatically
// once the default bank account differs from the one it failed on — retrying
// the same rejected account would just fail again.
export async function advanceOrganizationWithdrawals(organizationId: string, opts: { forceFailedRetry?: boolean } = {}) {
  const rows = await pool.query(
    `SELECT id, "stripePayoutId", "payoutStatus" FROM "wallet_withdrawal"
     WHERE "organizationId" = $1 AND status = 'processing' ORDER BY "createdAt" ASC`,
    [organizationId]
  );
  for (const row of rows.rows) {
    if (row.payoutStatus === "failed" && !opts.forceFailedRetry && !(await bankChangedSince(organizationId, row.stripePayoutId))) {
      continue;
    }
    await advanceWithdrawal(row.id).catch((e) => console.error("[advanceOrganizationWithdrawals]", row.id, e));
  }
}

async function bankChangedSince(organizationId: string, failedPayoutId: string | null): Promise<boolean> {
  if (!failedPayoutId) return true;
  const org = await pool.query(`SELECT "stripeConnectAccountId" FROM "organization" WHERE id = $1`, [organizationId]);
  const accountId = org.rows[0]?.stripeConnectAccountId;
  if (!accountId) return false;
  const [payout, account] = await Promise.all([
    stripe.payouts.retrieve(failedPayoutId, {}, { stripeAccount: accountId }),
    stripe.accounts.retrieve(accountId),
  ]);
  const failedDestination = typeof payout.destination === "string" ? payout.destination : payout.destination?.id;
  const current = account.external_accounts?.data.find((b) => b.default_for_currency)?.id;
  return Boolean(current && current !== failedDestination);
}

export async function advanceAllOpenWithdrawals(): Promise<number> {
  const rows = await pool.query(
    `SELECT DISTINCT "organizationId" FROM "wallet_withdrawal" WHERE status = 'processing' AND "organizationId" IS NOT NULL`
  );
  for (const row of rows.rows) await advanceOrganizationWithdrawals(row.organizationId);
  return rows.rowCount ?? 0;
}

export async function alertAdmins(subject: string, message: string) {
  console.error(`[payouts] ${subject}: ${message}`);
  const admins = await pool.query(`SELECT email FROM "user" WHERE role = 'super_admin' AND email IS NOT NULL`);
  const html = layout(`<h1 style="margin:0 0 16px;font-size:20px;font-weight:900;color:#18181b;">${subject}</h1>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-wrap;">${message.replace(/</g, "&lt;")}</p>`);
  await Promise.all(
    admins.rows.map((r: { email: string }) =>
      resend.emails.send({ from: FROM, to: r.email, subject: `Playver — ${subject}`, html }).catch(() => {})
    )
  );
}
