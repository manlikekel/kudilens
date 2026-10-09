import type { FinanceData } from "./core";
import { getAssumptions } from "./assumptions";
import { simulatePath } from "./engine";
import { roundMoney } from "./money";
import { mulberry32, normal, percentile } from "./rng";

export type View = "nominal" | "real" | "usd";

export interface FanPoint {
  yearOffset: number;
  year: number;
  age: number | null;
  nominal: [number, number, number]; // p10, p50, p90 in NGN
  real: [number, number, number]; // today's NGN
  usd: [number, number, number];
}

export interface MonteCarloResult {
  points: FanPoint[];
  sims: number;
  formula: string;
}

/**
 * Yearly Monte Carlo of net worth using the shared engine: lognormal returns for every pot
 * and physical asset, inflation and Naira depreciation drawn as correlated shocks, income and
 * expenses growing separately, and deficits drawing down cash then investments.
 */
export function monteCarlo(
  data: FinanceData,
  opts: { years?: number; sims?: number; seed?: number; extraMonthly?: number; volScale?: number } = {},
): MonteCarloResult {
  const a = getAssumptions(data);
  const years = Math.max(1, opts.years ?? 25);
  const sims = opts.sims ?? 1000;
  const rand = mulberry32(opts.seed ?? 42);
  const draw = () => normal(rand);
  const buckets = Array.from({ length: years + 1 }, () => ({ nominal: [] as number[], real: [] as number[], usd: [] as number[] }));

  for (let s = 0; s < sims; s++) {
    const path = simulatePath(data, years, draw, { volScale: opts.volScale ?? 1, extraMonthly: opts.extraMonthly ?? 0 });
    path.forEach((p, y) => {
      const b = buckets[y]!;
      b.nominal.push(p.netWorth);
      b.real.push(p.real);
      b.usd.push(p.usd);
    });
  }

  const y0 = new Date().getFullYear();
  const age = data.profile?.age ?? null;
  const pct = (arr: number[]): [number, number, number] => {
    const sorted = [...arr].sort((x, y) => x - y);
    return [roundMoney(percentile(sorted, 10)), roundMoney(percentile(sorted, 50)), roundMoney(percentile(sorted, 90))];
  };
  const pc = (x: number) => `${(x * 100).toFixed(0)}%`;
  return {
    sims,
    points: buckets.map((b, y) => ({
      yearOffset: y,
      year: y0 + y,
      age: age != null ? age + y : null,
      nominal: pct(b.nominal),
      real: pct(b.real),
      usd: pct(b.usd),
    })),
    formula: `${sims} simulated futures, starting from your accounts, investments and assets. Each year every pot grows by a lognormal return (expected return, with its volatility); physical assets grow at their appreciation rate. Inflation (${pc(a.inflation)} ± 5%) and Naira depreciation (${pc(a.fxDepreciation)} ± 15%) are drawn together with correlation ${a.infFxCorrelation}. Income grows ${pc(a.salaryGrowth)}/yr while living costs grow with inflation; any shortfall is taken from cash, then investments. Cash earns ${pc(a.cashYieldRatio)} of inflation. Real = nominal ÷ price level.`,
  };
}

export function pickHorizons(data: FinanceData): number[] {
  const age = data.profile?.age;
  const ret = data.profile?.retirement_age;
  const hs = [1, 5, 10, 20];
  if (age && ret && ret > age && !hs.includes(ret - age)) hs.push(ret - age);
  return hs.sort((x, y) => x - y);
}
