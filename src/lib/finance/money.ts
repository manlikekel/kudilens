/**
 * Money helpers. Amounts are exchanged as integer minor units (kobo / cents) at the edges;
 * floats are used only inside simulations and rounded back to whole units at the output.
 */
export interface Money {
  minor: number; // integer
  currency: string;
}

export function toMinor(amount: number): number {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromMinor(minor: number): number {
  return Math.round(Number(minor) || 0) / 100;
}

export function money(amount: number, currency: string): Money {
  return { minor: toMinor(amount), currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error(`Cannot add ${a.currency} to ${b.currency} without converting`);
  return { minor: a.minor + b.minor, currency: a.currency };
}

/** Sums amounts exactly in minor units, returns major units. */
export function sumExact(amounts: number[]): number {
  return fromMinor(amounts.reduce((t, x) => t + toMinor(x), 0));
}

/** Round a simulated float back to whole currency units for display/storage. */
export function roundMoney(x: number): number {
  return Number.isFinite(x) ? Math.round(x) : 0;
}
