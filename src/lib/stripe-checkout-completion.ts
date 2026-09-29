// Shared "a Checkout Session finished paying" handler, used by two callers:
// the Stripe webhook (src/app/api/stripe/webhook/route.ts, the source of
// truth) AND the event/team detail page's own success-page reconciliation
// (src/app/[locale]/events/[eventId]/page.tsx). The page-level call exists
// because the webhook is delivered asynchronously — a user can land back on
// `?payment=success` before Stripe's webhook reaches us (or, in local dev,
// with no `stripe listen` running at all), which showed a stale "Awaiting
// payment" state even though the card was actually charged. Both callers are
// safe to run for the same session: completeEventStripePayment/
// completeTeamStripePayment are guarded by a `status = 'pending'` WHERE
// clause, so whichever call lands first wins and the other is a no-op.
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/lib/db";
import { completeEventStripePayment } from "@/app/actions/event";
import { completeTeamStripePayment } from "@/app/actions/tournament";

async function handleWalletTopup(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const amount = session.amount_total;
  if (!userId || !amount) return;

  await withTransaction(async (client) => {
    const ledgerInsert = await client.query(
      `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "stripeSessionId")
       VALUES ($1, $2, 'deposit', $3, 0, $4)
       ON CONFLICT ("stripeSessionId") DO NOTHING
       RETURNING id`,
      [crypto.randomUUID(), userId, amount, session.id]
    );
    // Only credit the balance if this ledger row is new — a Stripe webhook
    // retry (at-least-once delivery) must not double-credit the wallet.
    if (ledgerInsert.rowCount === 0) return;

    const updateRes = await client.query(
      `UPDATE "user" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2 RETURNING "walletBalance"`,
      [amount, userId]
    );
    await client.query(`UPDATE "wallet_transaction" SET "balanceAfter" = $1 WHERE "stripeSessionId" = $2`, [
      updateRes.rows[0]?.walletBalance ?? amount,
      session.id,
    ]);
  });

  revalidatePath("/dashboard/wallet");
}

async function handleEventPayment(session: Stripe.Checkout.Session) {
  const eventId = session.metadata?.eventId;
  const userId = session.metadata?.userId;
  const remainderCents = session.amount_total;
  const walletCreditCents = Number(session.metadata?.walletCreditCents ?? "0");
  if (!eventId || !userId || !remainderCents) return;

  await completeEventStripePayment(
    eventId,
    userId,
    remainderCents,
    walletCreditCents,
    session.id,
    session.metadata?.categoryId || undefined,
    session.metadata?.pricingTierId || undefined
  );
}

async function handleTeamPayment(session: Stripe.Checkout.Session) {
  const teamId = session.metadata?.teamId;
  const userId = session.metadata?.userId;
  const remainderCents = session.amount_total;
  const walletCreditCents = Number(session.metadata?.walletCreditCents ?? "0");
  if (!teamId || !userId || !remainderCents) return;

  await completeTeamStripePayment(teamId, userId, remainderCents, walletCreditCents, session.id);
}

export async function completeCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.type === "wallet_topup") {
    await handleWalletTopup(session);
  } else if (session.metadata?.type === "event_payment") {
    await handleEventPayment(session);
  } else if (session.metadata?.type === "team_payment") {
    await handleTeamPayment(session);
  }
}
