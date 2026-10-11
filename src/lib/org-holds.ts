// Org wallet holds — money from an event stays unavailable until 48h after
// it ends, or indefinitely while it's cancelled, so refunds always have
// funds (anti-fraud; see docs/cashout-refunds-cancellations.md). Kept out of
// the "use server" actions file on purpose: exports there become publicly
// callable server actions, and these take an arbitrary organization id.
import { pool } from "@/lib/db";

export const WITHDRAWAL_HOLD_HOURS = 48;

// What each payment actually added to the org wallet: its net when fees were
// recorded, the full amount for payments from before fees existed.
export const EVENT_NET = `COALESCE(ep."netCents", ep.amount)`;
export const TEAM_NET = `COALESCE(ttp."netCents", ttp.amount)`;

// Organization-scoped twin of getHeldBalance (wallet.ts): money from an event
// stays held until 48h after it ends, or indefinitely while it's cancelled
// (so refunds always have funds). Team payments only count when they were
// credited to this org's wallet (ttp.organizationId).
export async function getOrganizationHeldBalance(organizationId: string): Promise<number> {
  const holds = await getOrganizationHolds(organizationId);
  return holds.reduce((sum, h) => sum + h.amountCents, 0);
}

export type HeldFunds = { eventId: string; eventTitle: string; amountCents: number; releasesAt: string | null };

export async function getOrganizationHolds(organizationId: string): Promise<HeldFunds[]> {
  const res = await pool.query(
    `SELECT e.id, e.title, e.status, e."endDateTime", SUM(x.net)::bigint AS held FROM (
       SELECT ep."eventId" AS "eventId", ${EVENT_NET} AS net
       FROM "event_payment" ep JOIN "event" e ON e.id = ep."eventId"
       WHERE e."organizationId" = $1 AND ep.status = 'completed' AND ep."refundedAt" IS NULL
       UNION ALL
       SELECT tt."tournamentId", ${TEAM_NET}
       FROM "tournament_team_payment" ttp JOIN "tournament_team" tt ON tt.id = ttp."teamId"
       WHERE ttp."organizationId" = $1 AND ttp."refundedAt" IS NULL
     ) x JOIN "event" e ON e.id = x."eventId"
     WHERE e.status = 'cancelled' OR NOW() < e."endDateTime" + INTERVAL '${WITHDRAWAL_HOLD_HOURS} hours'
     GROUP BY e.id, e.title, e.status, e."endDateTime"
     ORDER BY e."endDateTime" ASC`,
    [organizationId]
  );
  return res.rows.map((r) => ({
    eventId: r.id,
    eventTitle: r.title,
    amountCents: Number(r.held),
    releasesAt:
      r.status === "cancelled"
        ? null
        : new Date(new Date(r.endDateTime).getTime() + WITHDRAWAL_HOLD_HOURS * 3600 * 1000).toISOString(),
  }));
}

