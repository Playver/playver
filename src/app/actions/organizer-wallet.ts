"use server";

// An organization's wallet: balance, Stripe Connect payout onboarding, and
// withdrawals (MANAGE_PAYMENTS-gated, not just VIEW_PAYMENTS — payouts stay
// Owner/Admin-only). Org-owned events credit here instead of the creator's
// personal wallet (wallet.ts) — see event.ts's payment-completion functions.
// MIN_WITHDRAWAL_CENTS/WITHDRAWAL_HOLD_HOURS/InsufficientFundsError are
// duplicated from wallet.ts rather than shared — known debt, keep both files
// in sync if you change the rule.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool, withTransaction } from "@/lib/db";
import { requireOrganizationPermission } from "./organization";

const MIN_WITHDRAWAL_CENTS = 1000; // $10
const WITHDRAWAL_HOLD_HOURS = 48;

class InsufficientFundsError extends Error {}

// Organization-scoped twin of getHeldBalance (wallet.ts) — deliberately a
// separate function rather than a modification of it. getHeldBalance is the
// anti-fraud withdrawal-hold logic for personal wallets and is left untouched
// here; this mirrors the same 48h-post-event-end / indefinite-if-cancelled
// rule against organizationId instead of organizerId.
export async function getOrganizationHeldBalance(organizationId: string): Promise<number> {
  const [eventHeld, teamHeld] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(ep.amount), 0) as held FROM "event_payment" ep
       JOIN "event" e ON e.id = ep."eventId"
       WHERE e."organizationId" = $1 AND ep.status = 'completed' AND ep."refundedAt" IS NULL
         AND (e.status = 'cancelled' OR NOW() < e."endDateTime" + INTERVAL '${WITHDRAWAL_HOLD_HOURS} hours')`,
      [organizationId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(ttp.amount), 0) as held FROM "tournament_team_payment" ttp
       JOIN "tournament_team" tt ON tt.id = ttp."teamId"
       JOIN "event" e ON e.id = tt."tournamentId"
       WHERE e."organizationId" = $1 AND ttp."refundedAt" IS NULL
         AND (e.status = 'cancelled' OR NOW() < e."endDateTime" + INTERVAL '${WITHDRAWAL_HOLD_HOURS} hours')`,
      [organizationId]
    ),
  ]);
  return Number(eventHeld.rows[0].held) + Number(teamHeld.rows[0].held);
}

export type OrganizationWalletTransaction = {
  id: string;
  type: "event_payment_received" | "refund_sent" | "withdrawal";
  amount: number;
  balanceAfter: number;
  eventTitle: string | null;
  createdAt: string;
};

export async function getOrganizationWalletOverview() {
  const { organization } = await requireOrganizationPermission("VIEW_PAYMENTS");

  const [orgRow, held] = await Promise.all([
    pool.query(
      `SELECT "walletBalance", "stripeConnectAccountId", "stripeConnectOnboarded" FROM "organization" WHERE id = $1`,
      [organization.id]
    ),
    getOrganizationHeldBalance(organization.id),
  ]);
  const o = orgRow.rows[0];
  const balance = Number(o?.walletBalance ?? 0);

  const txRows = await pool.query(
    `SELECT wt.id, wt.type, wt.amount, wt."balanceAfter", wt."createdAt", e.title as "eventTitle"
     FROM "wallet_transaction" wt
     LEFT JOIN "event" e ON e.id = wt."eventId"
     WHERE wt."organizationId" = $1 ORDER BY wt."createdAt" DESC LIMIT 25`,
    [organization.id]
  );

  return {
    balance,
    heldBalance: held,
    availableBalance: Math.max(0, balance - held),
    connectAccountId: o?.stripeConnectAccountId as string | null,
    connectOnboarded: Boolean(o?.stripeConnectOnboarded),
    transactions: txRows.rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      balanceAfter: Number(r.balanceAfter),
      eventTitle: r.eventTitle ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    })) as OrganizationWalletTransaction[],
  };
}

// Powers the embedded Connect onboarding panel (ConnectPayoutOnboarding),
// rendered inline on /organizer/payments and on the organizer Settings
// page's payout section — instead of redirecting to Stripe's hosted
// connect.stripe.com onboarding page. Same underlying Express account and
// KYC requirements as before, just rendered in Playver's own UI. The client
// calls this every time it needs a fresh client_secret (account sessions
// expire after ~1 hour), so it's safe to call repeatedly.
export async function createOrganizationConnectAccountSession(): Promise<{ clientSecret?: string; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };
  const { organization } = await requireOrganizationPermission("MANAGE_PAYMENTS");

  const orgRow = await pool.query(
    `SELECT "stripeConnectAccountId", slug, website, "shortDescription" FROM "organization" WHERE id = $1`,
    [organization.id]
  );
  let accountId = orgRow.rows[0]?.stripeConnectAccountId as string | null;

  // Older orgs may hold an Express account (Stripe-collected requirements),
  // which forces Stripe's sign-in popup and can't be converted. Replace it
  // only if it never got payouts working — an Express account that already
  // pays out is left alone so that org never has to onboard again.
  let platformCollected = false;
  if (accountId) {
    const existing = await stripe.accounts.retrieve(accountId);
    platformCollected = existing.controller?.requirement_collection === "application";
    if (!platformCollected && !existing.payouts_enabled) accountId = null;
  }

  if (!accountId) {
    // No Stripe dashboard + platform-collected requirements is the only
    // account shape Stripe allows disable_stripe_user_authentication on,
    // which is what keeps the whole onboarding inline on our page instead
    // of opening a Stripe sign-in popup (the Express default).
    const account = await stripe.accounts.create({
      country: "CA",
      email: organization.publicEmail ?? session.user.email,
      controller: {
        stripe_dashboard: { type: "none" },
        requirement_collection: "application",
        fees: { payer: "application" },
        losses: { payments: "application" },
      },
      capabilities: { transfers: { requested: true } },
      // Prefilled so Stripe skips its "Business details" step — we already
      // know what every organizer does. Stripe rejects non-public URLs, so
      // local/dev base URLs fall back to the production domain.
      business_profile: {
        mcc: "7941", // Commercial sports, athletic fields, sports promoters
        url: orgWebsiteForStripe(orgRow.rows[0]),
        product_description:
          orgRow.rows[0]?.shortDescription ||
          "Organizes sports events and tournaments; participants register and pay entry fees through Playver.",
      },
    });
    accountId = account.id;
    platformCollected = true;
    await pool.query(
      `UPDATE "organization" SET "stripeConnectAccountId" = $1, "stripeConnectOnboarded" = false WHERE id = $2`,
      [accountId, organization.id]
    );
  }

  // Stripe only accepts disable_stripe_user_authentication on
  // platform-collected accounts; a kept legacy Express account falls back to
  // Stripe's defaults (sign-in popup) rather than failing the session.
  const features = platformCollected
    ? { disable_stripe_user_authentication: true, external_account_collection: true }
    : {};
  const accountSession = await stripe.accountSessions.create({
    account: accountId,
    // account_management powers "Change bank account" after onboarding —
    // organizers have no Stripe dashboard, so this is their only way to
    // update payout details.
    components: {
      account_onboarding: { enabled: true, features },
      account_management: { enabled: true, features },
    },
  });

  return { clientSecret: accountSession.client_secret };
}

function orgWebsiteForStripe(org: { slug: string; website: string | null } | undefined): string {
  if (org?.website && /^https:\/\//.test(org.website)) return org.website;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://")
    ? process.env.NEXT_PUBLIC_BASE_URL
    : "https://playver.ca";
  return `${base}/organizations/${org?.slug ?? ""}`;
}

function calculateWithdrawalFee(_amountCents: number): number {
  // Same "always 0 by design" reasoning as wallet.ts's requestWithdrawal:
  // processing cost is meant to come out of the organizer commission taken
  // at payment time, not skimmed again at withdrawal.
  return 0;
}

export async function requestOrganizationWithdrawal(amountCents: number): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };
  // MANAGE_PAYMENTS, not just VIEW_PAYMENTS — payouts stay Owner/Admin-only.
  // OPERATIONS_MANAGER (VIEW_PAYMENTS only) can see balances/transactions but
  // can't move money out.
  const { organization } = await requireOrganizationPermission("MANAGE_PAYMENTS");

  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL_CENTS) {
    return { error: "Minimum withdrawal is $10" };
  }

  const orgRow = await pool.query(
    `SELECT "stripeConnectAccountId", "walletBalance" FROM "organization" WHERE id = $1`,
    [organization.id]
  );
  const o = orgRow.rows[0];
  if (!o?.stripeConnectAccountId) return { error: "Connect a payout account first" };

  const held = await getOrganizationHeldBalance(organization.id);
  const available = Number(o.walletBalance) - held;
  if (amountCents > available) {
    return {
      error:
        held > 0
          ? "Some of your balance is held until 48 hours after your event ends"
          : "Insufficient balance",
    };
  }

  const account = await stripe.accounts.retrieve(o.stripeConnectAccountId);
  if (!account.payouts_enabled) return { error: "Your payout account isn't fully verified yet" };

  const withdrawalId = crypto.randomUUID();
  const feeCents = calculateWithdrawalFee(amountCents);

  try {
    await withTransaction(async (client) => {
      // Re-check held inside the transaction, right before the guarded debit,
      // same reasoning as requestWithdrawal: two concurrent requests can't
      // both slip past the pre-check above and jointly exceed what's available.
      const heldNow = await getOrganizationHeldBalance(organization.id);
      const debit = await client.query(
        `UPDATE "organization" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" - $3 >= $1 RETURNING "walletBalance"`,
        [amountCents, organization.id, heldNow]
      );
      if (debit.rowCount === 0) throw new InsufficientFundsError();

      await client.query(
        `INSERT INTO "wallet_withdrawal" (id, "organizationId", "requestedByUserId", amount, "platformFeeCents", status)
         VALUES ($1, $2, $3, $4, $5, 'processing')`,
        [withdrawalId, organization.id, session.user.id, amountCents, feeCents]
      );

      await client.query(
        `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "withdrawalId")
         VALUES ($1, $2, 'withdrawal', $3, $4, $5)`,
        [crypto.randomUUID(), organization.id, -amountCents, debit.rows[0].walletBalance, withdrawalId]
      );
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) return { error: "Insufficient balance" };
    console.error("[requestOrganizationWithdrawal]", e);
    return { error: "Something went wrong — please try again" };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents - feeCents,
        currency: "cad",
        destination: o.stripeConnectAccountId,
      },
      { idempotencyKey: withdrawalId }
    );
    await pool.query(
      `UPDATE "wallet_withdrawal" SET status = 'completed', "stripeTransferId" = $1 WHERE id = $2`,
      [transfer.id, withdrawalId]
    );
  } catch (e) {
    await withTransaction(async (client) => {
      await client.query(`UPDATE "organization" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2`, [
        amountCents,
        organization.id,
      ]);
      await client.query(
        `UPDATE "wallet_withdrawal" SET status = 'failed', "failureReason" = $1 WHERE id = $2`,
        [e instanceof Error ? e.message : "Transfer failed", withdrawalId]
      );
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "withdrawalId")
         VALUES ($1, $2, 'withdrawal', $3, (SELECT "walletBalance" FROM "organization" WHERE id = $2), $4)`,
        [crypto.randomUUID(), organization.id, amountCents, withdrawalId]
      );
    });
    return { error: "Withdrawal failed — funds returned to your organization's wallet" };
  }

  revalidatePath("/organizer/payments");
  return {};
}
