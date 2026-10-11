// Who pays the fees when a paid registration is refunded.
//
// Refunds go back to the player's Playver wallet in full, and the org wallet
// gives back only the net it was credited — so by default Playver absorbs
// both fees (the processing fee it already paid Stripe, and its own 5%).
// Every such refund is logged in refund_fee_absorption. An org that cancels
// often stops getting that for free: past REFUND_FREE_EVENTS refunded
// events, or REFUND_FREE_ABSORBED_CENTS of absorbed fees, inside a rolling
// REFUND_WINDOW_DAYS window, each further refund also charges the org the
// processing fee (Playver still returns its own 5%). The charge is capped at
// what's in the org wallet so a player's refund is never blocked by it; any
// part it couldn't cover is recorded as owed and taken from the org's next
// withdrawal (collectOwedRefundFees).
import type { PoolClient } from "@neondatabase/serverless";
import { pool } from "@/lib/db";
import { resend, FROM, layout, escapeHtml, BASE_URL } from "@/lib/emails/_shared";
import { formatPrice } from "@/lib/format-price";

export const REFUND_WINDOW_DAYS = 90;
export const REFUND_FREE_EVENTS = 2;
export const REFUND_FREE_ABSORBED_CENTS = 10000;

export type RefundFeeStatus = {
  refundedEventsInWindow: number;
  absorbedCentsInWindow: number;
  chargesProcessingFee: boolean;
};

export async function getRefundFeeStatus(
  db: Pick<PoolClient, "query">,
  organizationId: string,
  excludeRef?: string
): Promise<RefundFeeStatus> {
  const res = await db.query(
    `SELECT COUNT(DISTINCT COALESCE("eventId", "teamId")) FILTER (WHERE COALESCE("eventId", "teamId") IS DISTINCT FROM $2)::int AS events,
            COALESCE(SUM("stripeFeeCents" + "platformFeeCents" - "chargedToOrgCents"), 0)::bigint AS absorbed
     FROM "refund_fee_absorption"
     WHERE "organizationId" = $1 AND "createdAt" > NOW() - INTERVAL '${REFUND_WINDOW_DAYS} days'`,
    [organizationId, excludeRef ?? null]
  );
  const refundedEventsInWindow = Number(res.rows[0].events);
  const absorbedCentsInWindow = Number(res.rows[0].absorbed);
  return {
    refundedEventsInWindow,
    absorbedCentsInWindow,
    chargesProcessingFee:
      refundedEventsInWindow >= REFUND_FREE_EVENTS || absorbedCentsInWindow >= REFUND_FREE_ABSORBED_CENTS,
  };
}

// Called inside the refund transaction, after the org wallet has been
// debited the net. Returns how much extra was charged to the org.
export async function applyRefundFees(
  client: PoolClient,
  params: {
    organizationId: string;
    refKind: "eventId" | "teamId";
    refId: string;
    payerId: string;
    grossCents: number;
    stripeFeeCents: number;
    platformFeeCents: number;
  }
): Promise<{ chargedToOrgCents: number; newlyFlagged: boolean }> {
  const status = await getRefundFeeStatus(client, params.organizationId, params.refId);

  let chargedToOrgCents = 0;
  let owedCents = 0;
  if (status.chargesProcessingFee && params.stripeFeeCents > 0) {
    const bal = await client.query(`SELECT "walletBalance" FROM "organization" WHERE id = $1 FOR UPDATE`, [
      params.organizationId,
    ]);
    chargedToOrgCents = Math.min(params.stripeFeeCents, Math.max(0, Number(bal.rows[0]?.walletBalance ?? 0)));
    owedCents = params.stripeFeeCents - chargedToOrgCents;
    if (chargedToOrgCents > 0) {
      await client.query(`UPDATE "organization" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2`, [
        chargedToOrgCents,
        params.organizationId,
      ]);
    }
  }

  await client.query(
    `INSERT INTO "refund_fee_absorption"
       (id, "organizationId", "${params.refKind}", "payerId", "grossCents", "stripeFeeCents", "platformFeeCents", "chargedToOrgCents", "owedCents")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      crypto.randomUUID(),
      params.organizationId,
      params.refId,
      params.payerId,
      params.grossCents,
      params.stripeFeeCents,
      params.platformFeeCents,
      chargedToOrgCents,
      owedCents,
    ]
  );

  // Flag bookkeeping: set once when the org first crosses the threshold
  // (admins are emailed by the caller after commit), cleared once it's back
  // under it. Re-evaluated including this refund.
  const after = await getRefundFeeStatus(client, params.organizationId);
  const flag = await client.query(
    after.chargesProcessingFee
      ? `UPDATE "organization" SET "refundFeeFlaggedAt" = NOW() WHERE id = $1 AND "refundFeeFlaggedAt" IS NULL RETURNING id`
      : `UPDATE "organization" SET "refundFeeFlaggedAt" = NULL WHERE id = $1 AND "refundFeeFlaggedAt" IS NOT NULL RETURNING id`,
    [params.organizationId]
  );
  return { chargedToOrgCents, newlyFlagged: after.chargesProcessingFee && (flag.rowCount ?? 0) > 0 };
}

export async function getOwedRefundFees(db: Pick<PoolClient, "query">, organizationId: string): Promise<number> {
  const res = await db.query(
    `SELECT COALESCE(SUM("owedCents"), 0)::bigint AS owed FROM "refund_fee_absorption" WHERE "organizationId" = $1 AND "owedCents" > 0`,
    [organizationId]
  );
  return Number(res.rows[0].owed);
}

// Inside the withdrawal transaction (org row already locked): takes up to
// `maxCents` of owed refund fees out of the wallet, oldest first, and logs it
// in the ledger. Returns what was collected.
export async function collectOwedRefundFees(client: PoolClient, organizationId: string, maxCents: number): Promise<number> {
  if (maxCents <= 0) return 0;
  const rows = await client.query(
    `SELECT id, "owedCents" FROM "refund_fee_absorption"
     WHERE "organizationId" = $1 AND "owedCents" > 0 ORDER BY "createdAt" ASC FOR UPDATE`,
    [organizationId]
  );
  let collected = 0;
  for (const row of rows.rows) {
    const take = Math.min(Number(row.owedCents), maxCents - collected);
    if (take <= 0) break;
    await client.query(
      `UPDATE "refund_fee_absorption" SET "owedCents" = "owedCents" - $1, "chargedToOrgCents" = "chargedToOrgCents" + $1 WHERE id = $2`,
      [take, row.id]
    );
    collected += take;
  }
  if (collected > 0) {
    const bal = await client.query(
      `UPDATE "organization" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 RETURNING "walletBalance"`,
      [collected, organizationId]
    );
    await client.query(
      `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter")
       VALUES ($1, $2, 'refund_sent', $3, $4)`,
      [crypto.randomUUID(), organizationId, -collected, bal.rows[0].walletBalance]
    );
  }
  return collected;
}

export async function notifyAdminsOfRefundFlag(organizationId: string): Promise<void> {
  const [orgRes, admins] = await Promise.all([
    pool.query(`SELECT name, slug FROM "organization" WHERE id = $1`, [organizationId]),
    pool.query(`SELECT email FROM "user" WHERE role = 'super_admin' AND email IS NOT NULL`),
  ]);
  const org = orgRes.rows[0];
  const orgName = escapeHtml(org?.name ?? "An organization");
  const status = await getRefundFeeStatus(pool, organizationId);
  const html = layout(`
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#e21d12;">Refund fees</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#18181b;">${orgName} is refunding often</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#3f3f46;">In the last ${REFUND_WINDOW_DAYS} days they've refunded payments on
      ${status.refundedEventsInWindow} event(s), and Playver has absorbed ${formatPrice(status.absorbedCentsInWindow)} in fees.</p>
    <p style="margin:0 0 12px;font-size:15px;color:#3f3f46;">From now on their refunds charge them the processing fee automatically.
      Review the organization if this keeps happening: <a href="${BASE_URL}/organizations/${org?.slug ?? ""}">${orgName}</a>.</p>
  `);
  await Promise.all(
    admins.rows.map((row: { email: string }) =>
      resend.emails
        .send({ from: FROM, to: row.email, subject: `Playver — ${org?.name ?? "organization"} flagged for frequent refunds`, html })
        .catch(() => {})
    )
  );
}
