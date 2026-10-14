import { getRates, summarize, type FinanceData } from "./core";
import { getAssumptions } from "./assumptions";
import { convert } from "./fx";
import { roundMoney } from "./money";

export interface Independence {
  annualSpend: number;
  /** 25 × yearly spending: the pot a 4% yearly withdrawal could live on */
  target: number;
  invested: number;
  progress: number; // 0..1
  /** expected return after inflation */
  realReturn: number;
  yearlyAdded: number;
  yearsToGoal: number | null;
  ageAtGoal: number | null;
  formula: string;
}

/**
 * Financial independence: when investments alone could cover today's spending forever, using
 * the 4% rule. Everything is in today's money, so growth is the expected return minus inflation.
 */
export function independence(data: FinanceData, maxYears = 60): Independence {
  const s = summarize(data);
  const a = getAssumptions(data);
  const annualSpend = (s.monthlyExpenses + s.familyCost) * 12;
  const target = annualSpend * 25;
  const invested = s.totalInvested;
  const realReturn = (1 + s.weightedReturn / 100) / (1 + a.inflation) - 1;
  const yearlyAdded = s.monthlyContributions * 12;
  let v = invested;
  let years: number | null = v >= target ? 0 : null;
  for (let y = 1; years === null && y <= maxYears; y++) {
    v = v * (1 + realReturn) + yearlyAdded;
    if (v >= target) years = y;
  }
  const age = data.profile?.age ?? null;
  return {
    annualSpend: roundMoney(annualSpend),
    target: roundMoney(target),
    invested: roundMoney(invested),
    progress: target > 0 ? Math.min(1, invested / target) : 0,
    realReturn,
    yearlyAdded: roundMoney(yearlyAdded),
    yearsToGoal: years,
    ageAtGoal: years != null && age != null ? age + years : null,
    formula:
      `Target = yearly living and family costs × 25 (the 4% rule). Each year your investments grow by ` +
      `${(realReturn * 100).toFixed(1)}% after inflation (your ${s.weightedReturn.toFixed(1)}% expected return ` +
      `minus ${(a.inflation * 100).toFixed(0)}% inflation), plus your monthly contributions × 12. All in today's money.`,
  };
}

export type Bucket =
  "Stocks" | "Bonds & fixed income" | "Cash & money market" | "Property" | "Crypto" | "Other";

const BUCKET_OF: Record<string, Bucket> = {
  stocks: "Stocks",
  business: "Stocks",
  bonds: "Bonds & fixed income",
  "t-bills": "Bonds & fixed income",
  pension: "Bonds & fixed income",
  "money market": "Cash & money market",
  cash: "Cash & money market",
  "real estate": "Property",
  crypto: "Crypto",
};

export interface AllocationRow {
  bucket: Bucket;
  value: number;
  share: number; // 0..1 of the whole
  target: number | null; // 0..1, null when there's no suggestion for this bucket
}

/** Suggested stock share for a risk level, trimmed after 40 so it eases off as retirement nears. */
export function targetStockShare(risk: string, age: number | null): number {
  const base = risk === "growth" ? 0.8 : risk === "conservative" ? 0.3 : 0.6;
  const trim = age != null && age > 40 ? (age - 40) * 0.01 : 0;
  return Math.max(0.2, base - trim);
}

/**
 * Current mix of investments, accounts and property against a simple target: the stock share
 * for the user's risk level, 10% cash, and the rest in bonds. Property and crypto have no target.
 */
export function allocation(data: FinanceData): {
  rows: AllocationRow[];
  total: number;
  stockTarget: number;
} {
  const base = data.profile?.base_currency ?? "NGN";
  const rates = getRates(data);
  const c = (x: number, cur: string) => convert(Number(x) || 0, cur, base, rates);
  const sums = new Map<Bucket, number>();
  const add = (b: Bucket, v: number) => sums.set(b, (sums.get(b) ?? 0) + v);
  for (const i of data.investments)
    add(BUCKET_OF[i.asset_class] ?? "Other", c(i.current_value, i.currency));
  for (const acc of data.accounts ?? []) add("Cash & money market", c(acc.balance, acc.currency));
  for (const x of data.assets ?? [])
    add(
      x.kind === "land" || x.kind === "property"
        ? "Property"
        : x.kind === "pension"
          ? "Bonds & fixed income"
          : "Other",
      c(x.current_value, x.currency),
    );

  const total = [...sums.values()].reduce((t, v) => t + v, 0);
  const stockTarget = targetStockShare(
    data.profile?.risk_tolerance ?? "balanced",
    data.profile?.age ?? null,
  );
  // targets apply to the investable part (everything except property and crypto)
  const investable = total - (sums.get("Property") ?? 0) - (sums.get("Crypto") ?? 0);
  const scale = total > 0 ? investable / total : 0;
  const targets: Partial<Record<Bucket, number>> = {
    Stocks: stockTarget * scale,
    "Cash & money market": 0.1 * scale,
    "Bonds & fixed income": Math.max(0, 0.9 - stockTarget) * scale,
  };
  const order: Bucket[] = [
    "Stocks",
    "Bonds & fixed income",
    "Cash & money market",
    "Property",
    "Crypto",
    "Other",
  ];
  const rows = order
    .filter((b) => (sums.get(b) ?? 0) > 0 || targets[b] != null)
    .map((b) => ({
      bucket: b,
      value: roundMoney(sums.get(b) ?? 0),
      share: total > 0 ? (sums.get(b) ?? 0) / total : 0,
      target: targets[b] ?? null,
    }));
  return { rows, total: roundMoney(total), stockTarget };
}

export interface CurrencyShare {
  currency: string;
  value: number; // base currency
  share: number;
}

/** What everything you own is held in: a quick read on protection from Naira weakness. */
export function currencyMix(
  data: FinanceData,
  home = "NGN",
): { rows: CurrencyShare[]; foreignShare: number; home: string } {
  const base = data.profile?.base_currency ?? "NGN";
  const rates = getRates(data);
  const sums = new Map<string, number>();
  const add = (cur: string, v: number) =>
    sums.set(cur, (sums.get(cur) ?? 0) + convert(Number(v) || 0, cur, base, rates));
  for (const i of data.investments) add(i.currency, i.current_value);
  for (const acc of data.accounts ?? []) add(acc.currency, acc.balance);
  for (const x of data.assets ?? []) add(x.currency, x.current_value);
  const total = [...sums.values()].reduce((t, v) => t + v, 0);
  const rows = [...sums.entries()]
    .map(([currency, value]) => ({
      currency,
      value: roundMoney(value),
      share: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const foreign = rows.filter((r) => r.currency !== home).reduce((t, r) => t + r.share, 0);
  return { rows, foreignShare: foreign, home };
}
