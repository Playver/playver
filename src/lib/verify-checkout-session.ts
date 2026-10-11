// completeEventStripePayment/completeTeamStripePayment live in "use server"
// files, so Next treats them as reachable by direct POST even though only
// the webhook (and the success-page reconciliation) call them. They credit
// organization wallets, so they re-check the claimed payment against Stripe
// itself rather than trusting their arguments.
import { stripe } from "@/lib/stripe";

export async function assertPaidCheckoutSession(
  sessionId: string,
  expected: {
    type: "event_payment" | "team_payment";
    refKey: "eventId" | "teamId";
    refId: string;
    userId: string;
    remainderCents: number;
    walletCreditCents: number;
  }
): Promise<void> {
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  const ok =
    s.status === "complete" &&
    s.payment_status === "paid" &&
    s.metadata?.type === expected.type &&
    s.metadata?.[expected.refKey] === expected.refId &&
    s.metadata?.userId === expected.userId &&
    s.amount_total === expected.remainderCents &&
    Number(s.metadata?.walletCreditCents ?? "0") === expected.walletCreditCents;
  if (!ok) throw new Error(`Checkout session ${sessionId} doesn't match the payment being recorded`);
}
