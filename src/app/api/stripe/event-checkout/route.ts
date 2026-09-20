import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/db";
import { payForEventWithWallet } from "@/app/actions/event";
import { getAvailableWalletBalance } from "@/app/actions/wallet";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, useWallet = true } = await request.json();
  if (typeof eventId !== "string" || !eventId) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const eventRes = await pool.query(
    `SELECT id, title, "organizerId", capacity, price, status, "endDateTime"
     FROM "event" WHERE id = $1`,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status === "cancelled") return NextResponse.json({ error: "This event has been cancelled" }, { status: 400 });
  if (!event.price) return NextResponse.json({ error: "Event is free" }, { status: 400 });
  if (new Date(event.endDateTime) < new Date()) return NextResponse.json({ error: "Event has ended" }, { status: 400 });
  if (event.organizerId === session.user.id) {
    return NextResponse.json({ error: "You can't pay to join your own event" }, { status: 400 });
  }

  const existingParticipant = await pool.query(
    `SELECT 1 FROM "event_participant" WHERE "eventId" = $1 AND "userId" = $2`,
    [eventId, session.user.id]
  );
  if (existingParticipant.rows.length > 0) {
    return NextResponse.json({ error: "You're already registered for this event" }, { status: 400 });
  }

  if (event.capacity) {
    const countRes = await pool.query(`SELECT COUNT(*) FROM "event_participant" WHERE "eventId" = $1`, [eventId]);
    if (Number(countRes.rows[0].count) >= Number(event.capacity)) {
      return NextResponse.json({ error: "Event is full" }, { status: 400 });
    }
  }

  const price = Number(event.price);
  // useWallet: false means the player explicitly chose "pay full amount by
  // card" in the confirmation dialog (EventJoinButton) instead of having
  // their wallet balance applied automatically.
  const availableBalance = useWallet === false ? 0 : await getAvailableWalletBalance(session.user.id);
  const creditCents = Math.min(availableBalance, price);
  const remainderCents = price - creditCents;

  // Wallet credit covers the whole price — pay immediately, no card needed.
  if (remainderCents === 0) {
    const result = await payForEventWithWallet(eventId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ paidByWallet: true });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // Applied as a real Stripe coupon (rather than just lowering the line-item
  // price) so the checkout page itemizes it — "Event $200.00, Wallet credit
  // −$50.00, Total $150.00" — instead of silently showing a smaller number.
  let discounts: { coupon: string }[] | undefined;
  if (creditCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: creditCents,
      currency: "cad",
      duration: "once",
      max_redemptions: 1,
      name: "Wallet credit",
    });
    discounts = [{ coupon: coupon.id }];
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "cad",
          product_data: { name: event.title },
          unit_amount: price,
        },
        quantity: 1,
      },
    ],
    discounts,
    metadata: { type: "event_payment", eventId, userId: session.user.id, walletCreditCents: String(creditCents) },
    success_url: `${baseUrl}/events/${eventId}?payment=success`,
    cancel_url: `${baseUrl}/events/${eventId}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
