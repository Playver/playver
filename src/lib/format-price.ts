// All prices are stored/passed around in cents (matches Stripe's own units) —
// this is the only place that formats to a display string.
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
