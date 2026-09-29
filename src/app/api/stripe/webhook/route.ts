import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/db";
import { resend, FROM, layout } from "@/lib/emails/_shared";
import { completeCheckoutSession } from "@/lib/stripe-checkout-completion";

async function flagPaymentDisputeForReview(charge: Stripe.Charge, reason: string) {
  console.error("[stripe webhook] payment dispute/refund needs manual review", {
    chargeId: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    reason,
  });

  const admins = await pool.query(`SELECT email FROM "user" WHERE role = 'super_admin' AND email IS NOT NULL`);
  await Promise.all(
    admins.rows.map((row: { email: string }) =>
      resend.emails
        .send({
          from: FROM,
          to: row.email,
          subject: "Playver — payment dispute needs review",
          html: layout(
            `<p>A Stripe charge was ${reason}.</p>
             <p>Charge: ${charge.id}<br/>Amount: ${(charge.amount / 100).toFixed(2)} ${charge.currency.toUpperCase()}</p>
             <p>If the underlying wallet funds have already been spent, this needs manual reconciliation.</p>`
          ),
        })
        .catch(() => {})
    )
  );
}

async function handlePlatformEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    await completeCheckoutSession(event.data.object);
    return;
  }

  if (event.type === "charge.refunded") {
    await flagPaymentDisputeForReview(event.data.object, "refunded");
    return;
  }

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object;
    const charge = await stripe.charges.retrieve(dispute.charge as string);
    await flagPaymentDisputeForReview(charge, "disputed");
    return;
  }
}

async function handleConnectAccountEvent(event: Stripe.Event) {
  if (event.type !== "account.updated") return;
  const account = event.data.object;
  const onboarded = Boolean(account.details_submitted && account.payouts_enabled);

  const userUpdate = await pool.query(
    `UPDATE "user" SET "stripeConnectOnboarded" = $1 WHERE "stripeConnectAccountId" = $2 RETURNING id`,
    [onboarded, account.id]
  );
  if (userUpdate.rowCount && userUpdate.rowCount > 0) {
    revalidatePath("/dashboard/wallet");
    return;
  }

  await pool.query(`UPDATE "organization" SET "stripeConnectOnboarded" = $1 WHERE "stripeConnectAccountId" = $2`, [
    onboarded,
    account.id,
  ]);
  revalidatePath("/organizer/payments");
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  // Two separate Stripe webhook destinations point at this same URL — one
  // for platform ("Your account") events, one for Connect ("Connected
  // accounts") events — and Stripe signs each with its own secret. Try
  // both; exactly one will verify for any given request.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_CONNECT].filter(
    (s): s is string => Boolean(s)
  );

  let event: Stripe.Event | undefined;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      // Try the next secret — a signature mismatch here just means this
      // wasn't the destination that sent it, not necessarily a forged request.
    }
  }
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.account) {
    await handleConnectAccountEvent(event);
  } else {
    await handlePlatformEvent(event);
  }

  return NextResponse.json({ received: true });
}
