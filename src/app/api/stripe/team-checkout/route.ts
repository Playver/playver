import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/db";
import { getAvailableWalletBalance } from "@/app/actions/wallet";
import { resolveRegistrationPrice } from "@/lib/event-registration-tables";

// Always redirects to a real Stripe Checkout session — unlike
// event-checkout's "wallet credit fully covers it, skip Stripe" shortcut,
// team payment never silently completes via wallet alone. Any available
// wallet credit is still applied as a discount on the Checkout page itself
// (same "Team $X, Wallet credit -$Y, Total $Z" itemization as events), it
// just never bypasses Checkout entirely.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await request.json();
  if (typeof teamId !== "string" || !teamId) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT tt.id, tt.name, tt."captainId", tt.status, e.title, e."organizerId", e.price, e.status as "tournamentStatus", e.id as "tournamentId", e."endDateTime", ec.price as "categoryPrice"
     FROM "tournament_team" tt
     JOIN "event" e ON e.id = tt."tournamentId"
     LEFT JOIN "event_category" ec ON ec.id = tt."categoryId"
     WHERE tt.id = $1`,
    [teamId]
  );
  const team = result.rows[0];
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.captainId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (team.status !== "pending") return NextResponse.json({ error: "Team is already registered" }, { status: 400 });
  if (team.tournamentStatus === "cancelled") {
    return NextResponse.json({ error: "This tournament has been cancelled" }, { status: 400 });
  }
  const price = resolveRegistrationPrice(
    { price: Number(team.price) },
    team.categoryPrice != null ? { price: Number(team.categoryPrice) } : null
  );
  if (!price) return NextResponse.json({ error: "Tournament is free" }, { status: 400 });
  if (new Date(team.endDateTime) < new Date()) {
    return NextResponse.json({ error: "Tournament has ended" }, { status: 400 });
  }
  if (team.captainId === team.organizerId) {
    return NextResponse.json({ error: "You can't pay to join your own tournament" }, { status: 400 });
  }

  const availableBalance = await getAvailableWalletBalance(session.user.id);
  const creditCents = Math.min(availableBalance, price);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

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
          product_data: { name: `${team.title} — ${team.name}` },
          unit_amount: price,
        },
        quantity: 1,
      },
    ],
    discounts,
    metadata: { type: "team_payment", teamId, userId: session.user.id, walletCreditCents: String(creditCents) },
    // session_id lets the success page reconcile immediately (see
    // stripe-checkout-completion.ts) instead of depending entirely on the
    // webhook having already landed by the time the browser redirects back.
    success_url: `${baseUrl}/events/${team.tournamentId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/events/${team.tournamentId}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
