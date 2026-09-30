"use server";

// An individual athlete's personal wallet: balance and spending history only.
// This is the personal-wallet twin of organizer-wallet.ts (org-owned events
// credit that file's wallet instead — see event.ts's payment-completion
// functions for how that branch is chosen). Deliberately no payout/withdraw
// capability here — only organizations can cash out (see
// organizer-wallet.ts's requestOrganizationWithdrawal); an individual's
// wallet balance can only be spent on event fees within the platform, never
// transferred to a bank account. WITHDRAWAL_HOLD_HOURS is duplicated in
// organizer-wallet.ts rather than shared — known debt, keep both in sync if
// you change the rule.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

const WITHDRAWAL_HOLD_HOURS = 48;

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
    pool.query(`SELECT "walletBalance" FROM "user" WHERE id = $1`, [session.user.id]),
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
    transactions: txRows.rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      balanceAfter: Number(r.balanceAfter),
      createdAt: new Date(r.createdAt).toISOString(),
    })) as WalletTransaction[],
  };
}
