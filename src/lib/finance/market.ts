/**
 * Live economic assumptions, gathered on the server from public sources and applied in
 * getAssumptions() when the user leaves "Fill from live data" on. Values are percentages, like
 * the profile columns they replace (except correlation, -1..1, and cashYieldRatio, a share).
 */
export interface LiveValue {
  value: number;
  /** what the number is, in one line */
  label: string;
  source: string;
  sourceUrl: string;
  asOf: string; // ISO date or period like "August 2026"
}

export interface MarketAssumptions {
  fetchedAt: string;
  inflation?: LiveValue; // % per year
  fxDepreciation?: LiveValue; // % per year, Naira loss vs USD
  foreignInflation?: LiveValue; // % per year
  inflationFxCorrelation?: LiveValue; // -1..1
  cashYieldRatio?: LiveValue; // share of inflation
  educationInflation?: LiveValue; // % per year
  /** for context only: last 12 months' Naira move, % (negative = Naira strengthened) */
  fxChange1y?: LiveValue;
}

/** Pearson correlation of two equal-length series; null if undefined. */
export function correlation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((t, x) => t + x, 0) / n;
  const my = ys.slice(0, n).reduce((t, y) => t + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Yearly rate that turns `from` into `to` over `years`. */
export function annualised(from: number, to: number, years: number): number {
  return years > 0 && from > 0 ? Math.pow(to / from, 1 / years) - 1 : 0;
}
