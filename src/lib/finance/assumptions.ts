import { getRates, type FinanceData } from "./core";
import { convert, type FxRates } from "./fx";

/** Default annual volatility (standard deviation, %) per investment class. */
export const ASSET_VOLATILITY: Record<string, number> = {
  stocks: 25,
  bonds: 6,
  "real estate": 12,
  cash: 1,
  "money market": 2,
  "t-bills": 1,
  crypto: 70,
  pension: 10,
  business: 35,
  other: 20,
};

/** Default annual volatility (%) for physical assets. */
export const PHYSICAL_VOLATILITY: Record<string, number> = {
  land: 12,
  property: 10,
  vehicle: 8,
  pension: 10,
  other: 15,
};

export interface Assumptions {
  base: string;
  rates: FxRates;
  /** Naira per 1 USD today, NaN when no rate is available */
  ngnPerUSD: number;
  inflation: number; // decimal / yr
  inflationVolatility: number;
  fxDepreciation: number; // decimal / yr, Naira loss vs USD
  fxVolatility: number;
  infFxCorrelation: number; // -1..1
  cashYieldRatio: number; // cash earns this share of inflation
  foreignInflation: number;
  educationInflation: number;
  salaryGrowth: number;
  growContributions: boolean;
  incomeStability: string;
}

export function getAssumptions(data: FinanceData): Assumptions {
  const p = data.profile;
  // live market values (when the user keeps "Fill from live data" on) win over typed ones
  const m = data.market;
  const rates = getRates(data);
  const ngn = rates.perUSD["NGN"];
  const num = (v: unknown, d: number) => (v == null || !Number.isFinite(Number(v)) ? d : Number(v));
  return {
    base: p?.base_currency ?? "NGN",
    rates,
    ngnPerUSD: ngn && ngn > 0 ? ngn : NaN,
    inflation: num(m?.inflation?.value ?? p?.inflation_rate, 25) / 100,
    inflationVolatility: 0.05,
    fxDepreciation: num(m?.fxDepreciation?.value ?? p?.fx_depreciation, 15) / 100,
    fxVolatility: 0.15,
    infFxCorrelation: Math.max(
      -1,
      Math.min(1, num(m?.inflationFxCorrelation?.value ?? p?.inflation_fx_correlation, 0.6)),
    ),
    cashYieldRatio: num(m?.cashYieldRatio?.value ?? p?.cash_yield_ratio, 0.5),
    foreignInflation: num(m?.foreignInflation?.value ?? p?.foreign_inflation, 3) / 100,
    educationInflation: num(m?.educationInflation?.value ?? p?.education_inflation, 20) / 100,
    salaryGrowth: num(p?.salary_growth, 10) / 100,
    growContributions: p?.grow_contributions ?? true,
    incomeStability: p?.income_stability ?? "stable",
  };
}

/** Converts any amount into Naira at today's rate (0 if the rate is missing). */
export function toNGN(amount: number, currency: string, a: Assumptions): number {
  return convert(Number(amount) || 0, currency, "NGN", a.rates);
}
