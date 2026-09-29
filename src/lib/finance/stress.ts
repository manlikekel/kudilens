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

/** Naira loses `shock` of its value against USD overnight. */
export function devaluationShock(data: FinanceData, shock = 0.3): ShockResult {
  const a = getAssumptions(data);
  const newRate = a.rate / (1 - shock);
  let ngnAssets = 0;
  let usdAssets = 0;
  data.investments.forEach((i) => {
    if (i.currency === "USD") usdAssets += Number(i.current_value);
    else ngnAssets += Number(i.current_value);
  });
  let ngnDebt = 0;
  let usdDebt = 0;
  data.debts.forEach((d) => {
    if (d.currency === "USD") usdDebt += Number(d.balance);
    else ngnDebt += Number(d.balance);
  });
  const nw = (rate: number) => ngnAssets - ngnDebt + (usdAssets - usdDebt) * rate;
  const usdGoals = (data.goals ?? [])
    .filter((g) => g.currency === "USD")
    .reduce((t, g) => t + Number(g.target_amount) - Number(g.current_saved), 0);
  return {
    shock,
    before: { ngn: nw(a.rate), usd: nw(a.rate) / a.rate },
    after: { ngn: nw(newRate), usd: nw(newRate) / newRate },
    usdGoalsCostIncrease: Math.max(0, usdGoals) * (newRate - a.rate),
    formula: `New rate = ${a.rate.toLocaleString()} ÷ (1 − ${shock * 100}%) = ${Math.round(newRate).toLocaleString()} ₦/$. Naira items keep their Naira value; dollar items are re-priced at the new rate.`,
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
    const isForeign = g.currency === "USD" || /canada|abroad|uk|us\b|usa|foreign|japa/i.test(g.name);
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
    .filter((i) => i.currency === "USD")
    .reduce((t, i) => t + toNGN(i.current_value, i.currency, a), 0);
  return { foreignShare, currentForeignShare: inv > 0 ? usd / inv : 0, reasons };
}
