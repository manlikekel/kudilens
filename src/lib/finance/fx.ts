/**
 * Multi-currency conversion. All rates are expressed as "units of currency per 1 USD"
 * (USD is the base). Official rates come from the fx_rates table; the user can override
 * any of them (e.g. the parallel-market Naira rate) on their profile.
 * A missing rate is never guessed: convert() returns 0 and missingCurrencies() reports it.
 */
import { amountsHidden } from "./mask";

export const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "CAD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export interface FxRateRow {
  currency: string;
  per_usd: number;
  as_of: string;
  source?: string;
}

export interface FxRates {
  perUSD: Record<string, number>;
  asOf: string | null; // oldest official date used
  overridden: string[]; // currencies using the user's own rate
}

export function buildRates(rows: FxRateRow[] = [], overrides: Record<string, unknown> = {}): FxRates {
  const perUSD: Record<string, number> = { USD: 1 };
  let asOf: string | null = null;
  for (const r of rows) {
    const v = Number(r.per_usd);
    if (v > 0) {
      perUSD[r.currency] = v;
      if (!asOf || r.as_of < asOf) asOf = r.as_of;
    }
  }
  const overridden: string[] = [];
  for (const [cur, raw] of Object.entries(overrides ?? {})) {
    const v = Number(raw);
    if (cur !== "USD" && v > 0) {
      perUSD[cur] = v;
      overridden.push(cur);
    }
  }
  return { perUSD, asOf, overridden };
}

export function hasRate(rates: FxRates, cur: string): boolean {
  return (rates.perUSD[cur] ?? 0) > 0;
}

/** Converts between any two supported currencies through USD. Missing rate → 0 (never 1:1). */
export function convert(amount: number, from: string, to: string, rates: FxRates): number {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;
  if (from === to) return a;
  const f = rates.perUSD[from];
  const t = rates.perUSD[to];
  if (!f || !t) return 0;
  return (a / f) * t;
}

/** Currencies used in the data that cannot be converted into `base`. */
export function missingCurrencies(used: string[], base: string, rates: FxRates): string[] {
  const set = new Set(used.filter((c) => c && c !== base));
  if (set.size && !hasRate(rates, base)) return [...set, base].filter((v, i, arr) => arr.indexOf(v) === i);
  return [...set].filter((c) => !hasRate(rates, c));
}

const LOCALE: Record<string, string> = { NGN: "en-NG", USD: "en-US", GBP: "en-GB", EUR: "de-DE", CAD: "en-CA" };

/** Compact money with the correct symbol for each currency (₦2.4M, $12K, £1.2K, €3K, CA$5K). */
export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}): string {
  const compact = opts.compact ?? true;
  try {
    const fmt = new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 0,
    });
    if (amountsHidden()) {
      const symbol = fmt.formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
      return `${symbol}•••`;
    }
    return fmt.format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

export function rateLabel(rates: FxRates): string {
  const date = rates.asOf ? new Date(rates.asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  const parts = [date ? `Rates as of ${date}` : "No official rates loaded yet"];
  if (rates.overridden.length) parts.push(`your own rate for ${rates.overridden.join(", ")}`);
  return parts.join(" · ");
}
