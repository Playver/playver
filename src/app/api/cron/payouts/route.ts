import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { advanceAllOpenWithdrawals, alertAdmins, markDeposited, markPayoutFailed } from "@/lib/payouts";
import { sendFundsAvailableEmail } from "@/lib/emails/payouts";
import { getOrganizationHeldBalance } from "@/lib/org-holds";

// Daily safety net for organizer payouts (see vercel.json and
// src/lib/payouts.ts). Webhooks do the real-time work; this catches anything
// they missed:
// 1. retries every open withdrawal (queued transfers, blocked payouts)
// 2. re-checks payouts that should have arrived by now (missed webhook)
// 3. emails orgs whose 48h hold just ended
// 4. reconciles every org wallet against its own ledger and Stripe, and
//    emails admins about anything that doesn't add up or is stuck
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const problems: string[] = [];

  // 1. Retry everything open.
  const orgsRetried = await advanceAllOpenWithdrawals().catch((e) => {
    problems.push(`Retry pass failed: ${e instanceof Error ? e.message : e}`);
    return 0;
  });

  // 2. Payouts past their expected arrival with no webhook yet.
  const overdue = await pool.query(
    `SELECT w.id, w."stripePayoutId", o."stripeConnectAccountId" FROM "wallet_withdrawal" w
     JOIN "organization" o ON o.id = w."organizationId"
     WHERE w.status = 'processing' AND w."payoutStatus" = 'in_transit' AND w."payoutArrivalDate" < NOW() - INTERVAL '1 day'`
  );
  for (const row of overdue.rows) {
    try {
      const payout = await stripe.payouts.retrieve(row.stripePayoutId, {}, { stripeAccount: row.stripeConnectAccountId });
      if (payout.status === "paid") await markDeposited(payout);
      else if (payout.status === "failed" || payout.status === "canceled") await markPayoutFailed(payout);
    } catch (e) {
      problems.push(`Couldn't check payout ${row.stripePayoutId} for withdrawal ${row.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3. Holds that ended in the last 24h.
  const unlocked = await pool.query(
    `SELECT e."organizationId", array_agg(DISTINCT e.title) AS titles FROM "event" e
     WHERE e."organizationId" IS NOT NULL AND e.status <> 'cancelled'
       AND e."endDateTime" + INTERVAL '48 hours' BETWEEN NOW() - INTERVAL '24 hours' AND NOW()
       AND (EXISTS (SELECT 1 FROM "event_payment" ep WHERE ep."eventId" = e.id AND ep.status = 'completed' AND ep."refundedAt" IS NULL)
         OR EXISTS (SELECT 1 FROM "tournament_team_payment" ttp JOIN "tournament_team" tt ON tt.id = ttp."teamId"
                    WHERE tt."tournamentId" = e.id AND ttp."organizationId" = e."organizationId" AND ttp."refundedAt" IS NULL))
     GROUP BY e."organizationId"`
  );
  for (const row of unlocked.rows) {
    const bal = await pool.query(`SELECT "walletBalance" FROM "organization" WHERE id = $1`, [row.organizationId]);
    const available = Number(bal.rows[0]?.walletBalance ?? 0) - (await getOrganizationHeldBalance(row.organizationId));
    if (available > 0) await sendFundsAvailableEmail(row.organizationId, available, row.titles).catch(() => {});
  }

  // 4a. Every org wallet must equal the sum of its own ledger.
  const drift = await pool.query(
    `SELECT o.id, o.name, o."walletBalance", COALESCE(SUM(wt.amount), 0)::bigint AS ledger
     FROM "organization" o LEFT JOIN "wallet_transaction" wt ON wt."organizationId" = o.id
     GROUP BY o.id, o.name, o."walletBalance"
     HAVING o."walletBalance" <> COALESCE(SUM(wt.amount), 0)`
  );
  for (const row of drift.rows) {
    problems.push(`Wallet/ledger mismatch for "${row.name}" (${row.id}): balance ${row.walletBalance}¢ vs ledger ${row.ledger}¢`);
  }

  // 4b. Recent transfers must exist in Stripe with the right amount.
  const recent = await pool.query(
    `SELECT id, amount, "stripeTransferId" FROM "wallet_withdrawal"
     WHERE "organizationId" IS NOT NULL AND "stripeTransferId" IS NOT NULL AND "createdAt" > NOW() - INTERVAL '30 days'`
  );
  for (const row of recent.rows) {
    try {
      const transfer = await stripe.transfers.retrieve(row.stripeTransferId);
      if (transfer.amount !== Number(row.amount) || transfer.reversed) {
        problems.push(`Transfer ${transfer.id} doesn't match withdrawal ${row.id} (amount ${transfer.amount} vs ${row.amount}, reversed=${transfer.reversed})`);
      }
    } catch (e) {
      problems.push(`Transfer ${row.stripeTransferId} for withdrawal ${row.id} couldn't be found: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 4c. Anything open for more than 3 days needs a human.
  const stuck = await pool.query(
    `SELECT w.id, o.name, w.amount, w."payoutStatus", w."lastError" FROM "wallet_withdrawal" w
     JOIN "organization" o ON o.id = w."organizationId"
     WHERE w.status = 'processing' AND w."createdAt" < NOW() - INTERVAL '3 days' AND w."payoutStatus" IS DISTINCT FROM 'in_transit'`
  );
  for (const row of stuck.rows) {
    problems.push(
      `Withdrawal ${row.id} for "${row.name}" (${(Number(row.amount) / 100).toFixed(2)} CAD) open for 3+ days — payout ${row.payoutStatus ?? "not sent"}: ${row.lastError ?? "no error recorded"}`
    );
  }

  if (problems.length > 0) await alertAdmins("Payout check found issues", problems.join("\n\n"));

  return NextResponse.json({ orgsRetried, overdueChecked: overdue.rowCount, unlockEmails: unlocked.rowCount, problems });
}
