import { describe, expect, it } from "vitest";
import { calculateFees, netForCollected } from "./payment-fees";

describe("calculateFees", () => {
  it("matches the $200 example shown to organizers", () => {
    expect(calculateFees(20000)).toEqual({ grossCents: 20000, stripeFeeCents: 610, platformFeeCents: 1000, netCents: 18390 });
  });

  it("handles a $25 registration", () => {
    // 2.9% of 2500 = 72.5 -> 73, +30 = 103; 5% = 125
    expect(calculateFees(2500)).toEqual({ grossCents: 2500, stripeFeeCents: 103, platformFeeCents: 125, netCents: 2272 });
  });

  it("always sums back to the gross amount", () => {
    for (const gross of [1, 50, 99, 101, 333, 1999, 2500, 12345, 99999]) {
      const f = calculateFees(gross);
      expect(f.stripeFeeCents + f.platformFeeCents + f.netCents).toBe(gross);
      expect(f.netCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("never takes more than the payment on tiny amounts", () => {
    expect(calculateFees(20)).toEqual({ grossCents: 20, stripeFeeCents: 20, platformFeeCents: 0, netCents: 0 });
  });

  it("charges nothing on free or invalid amounts", () => {
    expect(calculateFees(0).netCents).toBe(0);
    expect(calculateFees(-500).stripeFeeCents).toBe(0);
    expect(calculateFees(Number.NaN).platformFeeCents).toBe(0);
  });
});

describe("netForCollected", () => {
  it("takes a collection shortfall off the organizer's net, not the fees", () => {
    const f = netForCollected(2500, 2000);
    expect(f.stripeFeeCents).toBe(103);
    expect(f.platformFeeCents).toBe(125);
    expect(f.netCents).toBe(2272 - 500);
  });

  it("never goes below zero", () => {
    expect(netForCollected(2500, 0).netCents).toBe(0);
  });
});
