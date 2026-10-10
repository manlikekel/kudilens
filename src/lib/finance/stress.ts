import type { FinanceData } from "./core";
import { getAssumptions, toNGN } from "./assumptions";

export interface RealReturn {
  name: string;
  currency: string;
  nominalNGN: number; // % in Naira terms
  real: number; // % after inflation
}

/** Real return = (1 + Naira return) / (1 + inflation) − 1. USD assets gain the FX drift. */
export function realReturns(data: FinanceData): RealReturn[] {
  const a = getAssumptions(data);
  return data.investments.map((i) => {
    const r = Number(i.expected_return) / 100;
    const ngn = i.currency === "USD" ? (1 + r) * (1 + a.fxDepreciation) - 1 : r;
    return {
      name: i.name,
      currency: i.currency,
      nominalNGN: ngn * 100,
      real: ((1 + ngn) / (1 + a.inflation) - 1) * 100,
    };
  });
}

export interface ShockResult {
  shock: number;
  before: { ngn: number; usd: number };
  after: { ngn: number; usd: number };
  usdGoalsCostIncrease: number; // extra NGN needed for USD goals
  formula: string;
}

/** Naira loses `shock` of its value against every foreign currency overnight. */
export function devaluationShock(data: FinanceData, shock = 0.3): ShockResult {
  const a = getAssumptions(data);
  const k = 1 / (1 - shock); // foreign items are worth k× more Naira
  let ngn = 0;
  let foreign = 0; // in today's Naira
  const add = (amount: number, cur: string, sign: 1 | -1) => {
    const v = toNGN(Number(amount), cur, a) * sign;
    if (cur === "NGN") ngn += v;
    else foreign += v;
  };
  data.investments.forEach((i) => add(i.current_value, i.currency, 1));
  (data.accounts ?? []).forEach((x) => add(x.balance, x.currency, 1));
  (data.assets ?? []).forEach((x) => add(x.current_value, x.currency, 1));
  data.debts.forEach((d) => add(d.balance, d.currency, -1));
  const foreignGoals = (data.goals ?? [])
    .filter((g) => g.currency !== "NGN")
    .reduce((t, g) => t + toNGN(Number(g.target_amount) - Number(g.current_saved), g.currency, a), 0);
  const rate = a.ngnPerUSD;
  const usd = (n: number, r: number) => (Number.isFinite(r) ? n / r : 0);
  const before = ngn + foreign;
  const after = ngn + foreign * k;
  return {
    shock,
    before: { ngn: before, usd: usd(before, rate) },
    after: { ngn: after, usd: usd(after, rate * k) },
    usdGoalsCostIncrease: Math.max(0, foreignGoals) * (k - 1),
    formula: Number.isFinite(rate)
      ? `New rate = ${Math.round(rate).toLocaleString()} ÷ (1 − ${shock * 100}%) = ${Math.round(rate * k).toLocaleString()} ₦/$ (other currencies move the same way). Naira items keep their Naira value; foreign items are re-priced.`
      : "No Naira exchange rate available — add one in My numbers → Profile.",
  };
}

export interface CurrencyMix {
  foreignShare: number; // 0..1
  currentForeignShare: number;
  reasons: string[];
}

/** Suggest a foreign-currency share from goals: foreign-priced goals should be funded in that currency. */
export function recommendCurrencyMix(data: FinanceData): CurrencyMix {
  const a = getAssumptions(data);
  const goals = data.goals ?? [];
  const reasons: string[] = [];
  let total = 0;
  let foreign = 0;
  goals.forEach((g) => {
    const v = toNGN(g.target_amount, g.currency, a);
    total += v;
    const isForeign = g.currency !== "NGN" || /canada|abroad|uk|us\b|usa|foreign|japa/i.test(g.name);
    if (isForeign) {
      foreign += v * 0.7;
      reasons.push(`"${g.name}" will be paid in foreign currency — fund about 70% of it in USD/CAD.`);
    } else foreign += v * 0.2;
  });
  const base = total > 0 ? foreign / total : 0.3;
  const foreignShare = Math.min(0.8, Math.max(0.2, base));
  if (reasons.length === 0) reasons.push("A 20–30% dollar buffer protects against Naira depreciation even for local goals.");
  const inv = data.investments.reduce((t, i) => t + toNGN(i.current_value, i.currency, a), 0);
  const usd = data.investments
    .filter((i) => i.currency !== "NGN")
    .reduce((t, i) => t + toNGN(i.current_value, i.currency, a), 0);
  return { foreignShare, currentForeignShare: inv > 0 ? usd / inv : 0, reasons };
}
