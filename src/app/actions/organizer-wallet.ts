"use server";

// An organization's wallet: balance (always net of fees — see
// payment-fees.ts), Stripe Connect payout setup, and withdrawals
// (MANAGE_PAYMENTS-gated, not just VIEW_PAYMENTS — payouts stay
// Owner/Admin-only). Org-owned events and tournaments credit here instead of
// the creator's personal wallet (wallet.ts) — see event.ts/tournament.ts.
// The money movement itself (transfer -> payout, retries, webhooks) lives in
// src/lib/payouts.ts.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool, withTransaction } from "@/lib/db";
import {
  collectOwedRefundFees,
  getOwedRefundFees,
  getRefundFeeStatus,
  REFUND_FREE_ABSORBED_CENTS,
  REFUND_FREE_EVENTS,
  REFUND_WINDOW_DAYS,
} from "@/lib/refund-fees";
import {
  advanceOrganizationWithdrawals,
  advanceWithdrawal,
  ensureManualPayouts,
  readinessFromAccount,
  type PayoutReadiness,
} from "@/lib/payouts";
import { EVENT_NET, getOrganizationHeldBalance, getOrganizationHolds, TEAM_NET } from "@/lib/org-holds";
import { requireOrganizationPermission } from "./organization";

class InsufficientFundsError extends Error {}

export type OrganizationWalletTransaction = {
  id: string;
  type: "event_payment_received" | "refund_sent" | "withdrawal";
  amount: number;
  balanceAfter: number;
  eventTitle: string | null;
  createdAt: string;
};

export type OrganizationWithdrawal = {
  id: string;
  amountCents: number;
  // queued: waiting on Stripe / a retry; on_the_way: payout sent to the bank;
  // deposited; needs_bank: the bank rejected it or a payout couldn't be sent;
  // returned: refused before leaving Playver, money back in the wallet.
  state: "queued" | "on_the_way" | "deposited" | "needs_bank" | "returned";
  arrivalDate: string | null;
  detail: string | null;
  createdAt: string;
};

function withdrawalState(r: { status: string; stripeTransferId: string | null; payoutStatus: string | null }): OrganizationWithdrawal["state"] {
  if (r.status === "failed") return "returned";
  if (r.status === "completed") return "deposited";
  if (r.payoutStatus === "failed" || r.payoutStatus === "blocked") return "needs_bank";
  if (r.payoutStatus === "in_transit" || r.payoutStatus === "pending") return "on_the_way";
  return "queued";
}

export async function getOrganizationWalletOverview() {
  const { organization } = await requireOrganizationPermission("VIEW_PAYMENTS");

  const [orgRow, holds, totals, txRows, withdrawalRows, refundStatus] = await Promise.all([
    pool.query(`SELECT "walletBalance", "stripeConnectAccountId", "stripeConnectOnboarded" FROM "organization" WHERE id = $1`, [
      organization.id,
    ]),
    getOrganizationHolds(organization.id),
    pool.query(
      `SELECT COALESCE(SUM(gross), 0)::bigint AS gross, COALESCE(SUM(stripe_fee), 0)::bigint AS stripe_fee,
              COALESCE(SUM(platform_fee), 0)::bigint AS platform_fee, COALESCE(SUM(net), 0)::bigint AS net, COUNT(*)::int AS count
       FROM (
         SELECT ep.amount AS gross, COALESCE(ep."stripeFeeCents", 0) AS stripe_fee, COALESCE(ep."platformFeeCents", 0) AS platform_fee, ${EVENT_NET} AS net
         FROM "event_payment" ep JOIN "event" e ON e.id = ep."eventId"
         WHERE e."organizationId" = $1 AND ep.status = 'completed' AND ep."refundedAt" IS NULL
         UNION ALL
         SELECT ttp.amount, COALESCE(ttp."stripeFeeCents", 0), COALESCE(ttp."platformFeeCents", 0), ${TEAM_NET}
         FROM "tournament_team_payment" ttp
         WHERE ttp."organizationId" = $1 AND ttp."refundedAt" IS NULL
       ) p`,
      [organization.id]
    ),
    pool.query(
      `SELECT wt.id, wt.type, wt.amount, wt."balanceAfter", wt."createdAt", COALESCE(e.title, te.title) as "eventTitle"
       FROM "wallet_transaction" wt
       LEFT JOIN "event" e ON e.id = wt."eventId"
       LEFT JOIN "tournament_team" tt ON tt.id = wt."teamId"
       LEFT JOIN "event" te ON te.id = tt."tournamentId"
       WHERE wt."organizationId" = $1 ORDER BY wt."createdAt" DESC LIMIT 25`,
      [organization.id]
    ),
    pool.query(
      `SELECT id, amount, status, "stripeTransferId", "payoutStatus", "payoutArrivalDate", "lastError", "failureReason", "createdAt"
       FROM "wallet_withdrawal" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC LIMIT 10`,
      [organization.id]
    ),
    getRefundFeeStatus(pool, organization.id),
  ]);
  const owedRefundFeesCents = await getOwedRefundFees(pool, organization.id);
  const o = orgRow.rows[0];
  const balance = Number(o?.walletBalance ?? 0);
  const heldBalance = holds.reduce((sum, h) => sum + h.amountCents, 0);

  // Live from Stripe, not the cached flag: the Withdraw button must only be
  // offered when a withdrawal can actually go through right now.
  let payoutReadiness: PayoutReadiness = { state: "not_started" };
  const accountId = o?.stripeConnectAccountId as string | null;
  if (accountId) {
    try {
      payoutReadiness = readinessFromAccount(await stripe.accounts.retrieve(accountId));
      const ready = payoutReadiness.state === "ready";
      if (ready !== Boolean(o?.stripeConnectOnboarded)) {
        await pool.query(`UPDATE "organization" SET "stripeConnectOnboarded" = $1 WHERE id = $2`, [ready, organization.id]);
      }
    } catch (e) {
      console.error("[getOrganizationWalletOverview] stripe account lookup failed", e);
      payoutReadiness = { state: "needs_info", currentlyDue: [], disabledReason: "stripe_unreachable" };
    }
  }

  // Anything still in flight gets nudged forward after the page is sent.
  if (withdrawalRows.rows.some((r) => r.status === "processing")) {
    after(() => advanceOrganizationWithdrawals(organization.id).catch((e) => console.error("[overview after]", e)));
  }

  const t = totals.rows[0];
  return {
    balance,
    heldBalance,
    availableBalance: Math.max(0, balance - heldBalance - owedRefundFeesCents),
    holds,
    earnings: {
      paymentCount: Number(t.count),
      grossCents: Number(t.gross),
      stripeFeeCents: Number(t.stripe_fee),
      platformFeeCents: Number(t.platform_fee),
      netCents: Number(t.net),
    },
    connectAccountId: accountId,
    payoutReadiness,
    refundFees: {
      ...refundStatus,
      owedCents: owedRefundFeesCents,
      windowDays: REFUND_WINDOW_DAYS,
      freeEvents: REFUND_FREE_EVENTS,
      freeAbsorbedCents: REFUND_FREE_ABSORBED_CENTS,
    },
    withdrawals: withdrawalRows.rows.map(
      (r): OrganizationWithdrawal => ({
        id: r.id,
        amountCents: Number(r.amount),
        state: withdrawalState(r),
        arrivalDate: r.payoutArrivalDate ? new Date(r.payoutArrivalDate).toISOString() : null,
        detail: r.status === "failed" ? r.failureReason ?? r.lastError : r.lastError,
        createdAt: new Date(r.createdAt).toISOString(),
      })
    ),
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

// Powers the embedded Connect panels (ConnectPayoutOnboarding) on
// /organizer/payments and the organizer Settings payout section. The client
// calls this every time it needs a fresh client_secret (account sessions
// expire after ~1 hour), so it's safe to call repeatedly. Errors are
// returned as a readable message (and logged) — the panel shows it instead
// of rendering blank.
export async function createOrganizationConnectAccountSession(): Promise<{ clientSecret?: string; error?: string }> {
  try {
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
      let existing: Stripe.Account = await stripe.accounts.retrieve(accountId);
      platformCollected = existing.controller?.requirement_collection === "application";
      if (!platformCollected && !existing.payouts_enabled) accountId = null;
      else if (platformCollected) existing = await ensureManualPayouts(existing);
    }

    if (!accountId) {
      // No Stripe dashboard + platform-collected requirements is the only
      // account shape Stripe allows disable_stripe_user_authentication on,
      // which is what keeps the whole onboarding inline on our page instead
      // of opening a Stripe sign-in popup (the Express default). Manual
      // payouts: each withdrawal becomes exactly one trackable payout.
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
        settings: { payouts: { schedule: { interval: "manual" } } },
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
    // platform-collected accounts; a kept legacy Express account falls back
    // to Stripe's defaults (sign-in popup) rather than failing the session.
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
  } catch (e) {
    // Full detail goes to the server log only — Stripe's messages can quote
    // (masked) API keys and account ids. The organizer sees a short code that
    // support can match against the log.
    console.error("[createOrganizationConnectAccountSession]", e);
    const code = e instanceof Stripe.errors.StripeError ? (e.code ?? e.type) : null;
    return { error: code ? `Stripe: ${code}` : "Couldn't start payout setup" };
  }
}

function orgWebsiteForStripe(org: { slug: string; website: string | null } | undefined): string {
  if (org?.website && /^https:\/\//.test(org.website)) return org.website;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://")
    ? process.env.NEXT_PUBLIC_BASE_URL
    : "https://playver.ca";
  return `${base}/organizations/${org?.slug ?? ""}`;
}

// Withdraw everything available. Fees were already taken when each payment
// came in, so the whole available balance goes out — no withdrawal fee, no
// minimum. Returns how far it got so the UI can say exactly what happened.
export async function requestOrganizationWithdrawal(): Promise<{
  error?: string;
  amountCents?: number;
  state?: OrganizationWithdrawal["state"];
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };
  // MANAGE_PAYMENTS, not just VIEW_PAYMENTS — payouts stay Owner/Admin-only.
  // OPERATIONS_MANAGER (VIEW_PAYMENTS only) can see balances/transactions but
  // can't move money out.
  const { organization } = await requireOrganizationPermission("MANAGE_PAYMENTS");

  const orgRow = await pool.query(`SELECT "stripeConnectAccountId" FROM "organization" WHERE id = $1`, [organization.id]);
  const accountId = orgRow.rows[0]?.stripeConnectAccountId as string | null;
  if (!accountId) return { error: "Set up your payout account first" };
  const readiness = readinessFromAccount(await stripe.accounts.retrieve(accountId));
  if (readiness.state !== "ready") return { error: "Stripe needs a few more details before you can withdraw — finish payout setup first" };

  const withdrawalId = crypto.randomUUID();
  let amountCents = 0;
  try {
    await withTransaction(async (client) => {
      // Lock the org row first so concurrent clicks serialize, then compute
      // held/available inside the same transaction.
      const bal = await client.query(`SELECT "walletBalance" FROM "organization" WHERE id = $1 FOR UPDATE`, [organization.id]);
      const held = await getOrganizationHeldBalance(organization.id);
      const available = Number(bal.rows[0].walletBalance) - held;
      // Refund fees the org owes from earlier cancellations come out first.
      const collected = await collectOwedRefundFees(client, organization.id, available);
      amountCents = available - collected;
      if (amountCents <= 0) throw new InsufficientFundsError();

      const debit = await client.query(
        `UPDATE "organization" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 RETURNING "walletBalance"`,
        [amountCents, organization.id]
      );
      await client.query(
        `INSERT INTO "wallet_withdrawal" (id, "organizationId", "requestedByUserId", amount, "platformFeeCents", status)
         VALUES ($1, $2, $3, $4, 0, 'processing')`,
        [withdrawalId, organization.id, session.user.id, amountCents]
      );
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "withdrawalId")
         VALUES ($1, $2, 'withdrawal', $3, $4, $5)`,
        [crypto.randomUUID(), organization.id, -amountCents, debit.rows[0].walletBalance, withdrawalId]
      );
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) return { error: "Nothing is available to withdraw yet" };
    console.error("[requestOrganizationWithdrawal]", e);
    return { error: "Something went wrong — nothing was withdrawn. Please try again." };
  }

  // The withdrawal is recorded; moving the money is the payout engine's job
  // and is retried automatically if Stripe isn't ready this instant.
  let result;
  try {
    result = await advanceWithdrawal(withdrawalId);
  } catch (e) {
    console.error("[requestOrganizationWithdrawal] advance", e);
    result = "queued" as const;
  }

  revalidatePath("/organizer/payments");
  return {
    amountCents,
    state:
      result === "failed"
        ? "returned"
        : result === "payout_sent" || result === "waiting"
          ? "on_the_way"
          : result === "done"
            ? "deposited"
            : "queued",
  };
}

// "Retry" on a payout the bank rejected, after the organizer updated their
// bank account (also retried automatically on account.updated).
export async function retryOrganizationPayouts(): Promise<{ error?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_PAYMENTS");
  try {
    await advanceOrganizationWithdrawals(organization.id, { forceFailedRetry: true });
  } catch (e) {
    console.error("[retryOrganizationPayouts]", e);
    return { error: "Couldn't retry right now — we'll keep trying automatically" };
  }
  revalidatePath("/organizer/payments");
  return {};
}
