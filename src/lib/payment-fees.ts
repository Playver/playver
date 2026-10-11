// The one place organizer fees are defined. Every paid registration on an
// organization's event/tournament is charged both fees, deducted at payment
// time, so an org wallet balance is always exactly what can be cashed out
// (withdrawals themselves are free — see organizer-wallet.ts).
//
// The processing fee is a fixed, published formula matching Stripe's
// Canadian domestic card rate, not the actual per-charge Stripe fee: it
// keeps the number organizers see predictable. Playver absorbs the
// difference when a card costs Stripe more (international, Amex) and keeps
// it when a registration is paid from wallet credit (no card charge).

export const PROCESSING_FEE_PERCENT = 2.9;
export const PROCESSING_FEE_FIXED_CENTS = 30;
export const PLATFORM_FEE_PERCENT = 5;

export type FeeBreakdown = {
  grossCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  netCents: number;
};

export function calculateFees(grossCents: number): FeeBreakdown {
  if (!Number.isFinite(grossCents) || grossCents <= 0) {
    return { grossCents: Math.max(0, Math.round(grossCents) || 0), stripeFeeCents: 0, platformFeeCents: 0, netCents: 0 };
  }
  const gross = Math.round(grossCents);
  // Fees can't exceed the payment itself on tiny amounts.
  const stripeFeeCents = Math.min(gross, Math.round((gross * PROCESSING_FEE_PERCENT) / 100) + PROCESSING_FEE_FIXED_CENTS);
  const platformFeeCents = Math.min(gross - stripeFeeCents, Math.round((gross * PLATFORM_FEE_PERCENT) / 100));
  return { grossCents: gross, stripeFeeCents, platformFeeCents, netCents: gross - stripeFeeCents - platformFeeCents };
}

// Net actually credited when less than the full price was collected (a
// wallet-credit shortfall at Stripe checkout completion): fees still follow
// the registration price, the shortfall comes off the organizer's net.
export function netForCollected(priceCents: number, collectedCents: number): FeeBreakdown {
  const fees = calculateFees(priceCents);
  const shortfall = Math.max(0, priceCents - collectedCents);
  return { ...fees, netCents: Math.max(0, fees.netCents - shortfall) };
}
