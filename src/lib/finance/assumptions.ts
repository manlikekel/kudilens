import { convert, type FinanceData } from "./core";

/** Default annual volatility (standard deviation, %) per asset class. User-editable assumptions live on the profile. */
export const ASSET_VOLATILITY: Record<string, number> = {
  stocks: 25,
  bonds: 6,
  "real estate": 12,
  cash: 1,
  crypto: 70,
  pension: 10,
  business: 35,
  other: 20,
};

export interface Assumptions {
  base: string;
  rate: number; // NGN per USD today
  inflation: number; // decimal / yr
  fxDepreciation: number; // decimal / yr, Naira loss vs USD
  fxVolatility: number;
  educationInflation: number;
  salaryGrowth: number;
  incomeStability: string;
}

export function getAssumptions(data: FinanceData): Assumptions {
  const p = data.profile;
  return {
    base: p?.base_currency ?? "NGN",
    rate: Number(p?.usd_ngn_rate) > 0 ? Number(p?.usd_ngn_rate) : 1500,
    inflation: Number(p?.inflation_rate ?? 25) / 100,
    fxDepreciation: Number(p?.fx_depreciation ?? 15) / 100,
    fxVolatility: 0.15,
    educationInflation: Number(p?.education_inflation ?? 20) / 100,
    salaryGrowth: Number(p?.salary_growth ?? 10) / 100,
    incomeStability: p?.income_stability ?? "stable",
  };
}

/** Converts any amount into Naira at today's rate. */
export function toNGN(amount: number, currency: string, a: Assumptions): number {
  return convert(Number(amount) || 0, currency, "NGN", a.rate);
}
