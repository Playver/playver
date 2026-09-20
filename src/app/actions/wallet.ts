"use server";

// An individual athlete's personal wallet: balance, Stripe Connect payout
// onboarding, and withdrawals. This is the personal-wallet twin of
// organizer-wallet.ts (org-owned events credit that file's wallet instead —
// see event.ts's payment-completion functions for how that branch is chosen).
// MIN_WITHDRAWAL_CENTS/WITHDRAWAL_HOLD_HOURS/InsufficientFundsError are
// duplicated in organizer-wallet.ts rather than shared — known debt, keep
// both in sync if you change the rule.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool, withTransaction } from "@/lib/db";

const MIN_WITHDRAWAL_CENTS = 1000; // $10
const WITHDRAWAL_HOLD_HOURS = 48;

class InsufficientFundsError extends Error {}

// Money from a paid signup stays "held" (not withdrawable) until 48 hours after
// that event's end date, or indefinitely if the event was cancelled and the
// refund hasn't cleared yet — so an organizer can never withdraw the money out
// from under a refund that might still need to happen. Computed live from the
// payment tables (not a stored/cached value) so it automatically tracks
// postponed dates and clears once refunds settle.
export async function getHeldBalance(organizerId: string): Promise<number> {
  const [eventHeld, teamHeld] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(ep.amount), 0) as held FROM "event_payment" ep
       JOIN "event" e ON e.id = ep."eventId"
       WHERE e."organizerId" = $1 AND ep.status = 'completed' AND ep."refundedAt" IS NULL
         AND (e.status = 'cancelled' OR NOW() < e."endDateTime" + INTERVAL '${WITHDRAWAL_HOLD_HOURS} hours')`,
      [organizerId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(ttp.amount), 0) as held FROM "tournament_team_payment" ttp
       JOIN "tournament_team" tt ON tt.id = ttp."teamId"
       JOIN "event" e ON e.id = tt."tournamentId"
       WHERE e."organizerId" = $1 AND ttp."refundedAt" IS NULL
         AND (e.status = 'cancelled' OR NOW() < e."endDateTime" + INTERVAL '${WITHDRAWAL_HOLD_HOURS} hours')`,
      [organizerId]
    ),
  ]);
  return Number(eventHeld.rows[0].held) + Number(teamHeld.rows[0].held);
}

// Balance minus this same user's held-as-organizer amount — deliberately the
// same "available" figure used for withdrawals, so funds a refund guarantee
// might need can't also be spent as wallet credit toward a *different*
// event's price. Used both to display a discounted price and, authoritatively,
// to compute the credit at checkout time in /api/stripe/event-checkout.
export async function getAvailableWalletBalance(userId: string): Promise<number> {
  const [userRow, held] = await Promise.all([
    pool.query(`SELECT "walletBalance" FROM "user" WHERE id = $1`, [userId]),
    getHeldBalance(userId),
  ]);
  const balance = Number(userRow.rows[0]?.walletBalance ?? 0);
  return Math.max(0, balance - held);
}

export type WalletTransaction = {
  id: string;
  type: "deposit" | "event_payment_sent" | "event_payment_received" | "refund_sent" | "refund_received" | "withdrawal";
  amount: number;
  balanceAfter: number;
  createdAt: string;
};

export async function getWalletOverview() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [userRow, held] = await Promise.all([
    pool.query(
      `SELECT "walletBalance", "stripeConnectAccountId", "stripeConnectOnboarded" FROM "user" WHERE id = $1`,
      [session.user.id]
    ),
    getHeldBalance(session.user.id),
  ]);
  const u = userRow.rows[0];
  const balance = Number(u?.walletBalance ?? 0);

  const txRows = await pool.query(
    `SELECT id, type, amount, "balanceAfter", "createdAt" FROM "wallet_transaction"
     WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 25`,
    [session.user.id]
  );

  return {
    balance,
    heldBalance: held,
    availableBalance: Math.max(0, balance - held),
    connectAccountId: u?.stripeConnectAccountId as string | null,
    connectOnboarded: Boolean(u?.stripeConnectOnboarded),
    transactions: txRows.rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      balanceAfter: Number(r.balanceAfter),
      createdAt: new Date(r.createdAt).toISOString(),
    })) as WalletTransaction[],
  };
}

// Powers the embedded Connect onboarding panel (ConnectPayoutOnboarding,
// rendered inline on /dashboard/wallet) instead of redirecting to Stripe's
// hosted connect.stripe.com onboarding page — same underlying Express
// account and KYC requirements, just rendered in Playver's own UI so it
// never looks or feels like a third-party redirect. The client calls this
// every time it needs a fresh client_secret (account sessions expire after
// ~1 hour), so it's safe to call repeatedly.
export async function createConnectAccountSession(): Promise<{ clientSecret?: string; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const userRow = await pool.query(`SELECT "stripeConnectAccountId" FROM "user" WHERE id = $1`, [session.user.id]);
  let accountId = userRow.rows[0]?.stripeConnectAccountId as string | null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "CA",
      email: session.user.email,
    });
    accountId = account.id;
    await pool.query(`UPDATE "user" SET "stripeConnectAccountId" = $1 WHERE id = $2`, [accountId, session.user.id]);
  }

  const accountSession = await stripe.accountSessions.create({
    account: accountId,
    components: { account_onboarding: { enabled: true } },
  });

  return { clientSecret: accountSession.client_secret };
}

function calculateWithdrawalFee(_amountCents: number): number {
  // Always 0 by design, not just "for now": Stripe/processing costs are meant
  // to be covered by the organizer commission taken at payment time (see
  // payForEventWithWallet/payForTeamWithWallet), not skimmed again here.
  // Deducting a fee at withdrawal too would double-charge the same cost.
  return 0;
}

export async function requestWithdrawal(amountCents: number): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL_CENTS) {
    return { error: "Minimum withdrawal is $10" };
  }

  const userRow = await pool.query(
    `SELECT "stripeConnectAccountId", "walletBalance" FROM "user" WHERE id = $1`,
    [session.user.id]
  );
  const u = userRow.rows[0];
  if (!u?.stripeConnectAccountId) return { error: "Connect a payout account first" };

  const held = await getHeldBalance(session.user.id);
  const available = Number(u.walletBalance) - held;
  if (amountCents > available) {
    return {
      error:
        held > 0
          ? "Some of your balance is held until 48 hours after your event ends"
          : "Insufficient balance",
    };
  }

  const account = await stripe.accounts.retrieve(u.stripeConnectAccountId);
  if (!account.payouts_enabled) return { error: "Your payout account isn't fully verified yet" };

  const withdrawalId = crypto.randomUUID();
  const feeCents = calculateWithdrawalFee(amountCents);

  try {
    await withTransaction(async (client) => {
      // Re-check held inside the transaction, right before the guarded debit,
      // so two concurrent withdrawal requests from the same organizer can't
      // both slip past the pre-check above and jointly exceed what's available.
      const heldNow = await getHeldBalance(session.user.id);
      const debit = await client.query(
        `UPDATE "user" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" - $3 >= $1 RETURNING "walletBalance"`,
        [amountCents, session.user.id, heldNow]
      );
      if (debit.rowCount === 0) throw new InsufficientFundsError();

      await client.query(
        `INSERT INTO "wallet_withdrawal" (id, "userId", amount, "platformFeeCents", status)
         VALUES ($1, $2, $3, $4, 'processing')`,
        [withdrawalId, session.user.id, amountCents, feeCents]
      );

      await client.query(
        `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "withdrawalId")
         VALUES ($1, $2, 'withdrawal', $3, $4, $5)`,
        [crypto.randomUUID(), session.user.id, -amountCents, debit.rows[0].walletBalance, withdrawalId]
      );
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) return { error: "Insufficient balance" };
    console.error("[requestWithdrawal]", e);
    return { error: "Something went wrong — please try again" };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents - feeCents,
        currency: "cad",
        destination: u.stripeConnectAccountId,
      },
      { idempotencyKey: withdrawalId }
    );
    await pool.query(
      `UPDATE "wallet_withdrawal" SET status = 'completed', "stripeTransferId" = $1 WHERE id = $2`,
      [transfer.id, withdrawalId]
    );
  } catch (e) {
    await withTransaction(async (client) => {
      await client.query(`UPDATE "user" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2`, [
        amountCents,
        session.user.id,
      ]);
      await client.query(
        `UPDATE "wallet_withdrawal" SET status = 'failed', "failureReason" = $1 WHERE id = $2`,
        [e instanceof Error ? e.message : "Transfer failed", withdrawalId]
      );
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "withdrawalId")
         VALUES ($1, $2, 'withdrawal', $3, (SELECT "walletBalance" FROM "user" WHERE id = $2), $4)`,
        [crypto.randomUUID(), session.user.id, amountCents, withdrawalId]
      );
    });
    return { error: "Withdrawal failed — funds returned to your wallet" };
  }

  revalidatePath("/dashboard/wallet");
  return {};
}
