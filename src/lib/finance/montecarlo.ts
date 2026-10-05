import { summarize, type FinanceData } from "./core";
import { ASSET_VOLATILITY, getAssumptions, toNGN } from "./assumptions";
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
 * Yearly Monte Carlo of net worth. Each pot grows by a normally-distributed return
 * (its expected return ± asset-class volatility). USD pots also move with a random
 * Naira depreciation path. Surplus cash is saved in a low-yield pot; debts amortise.
 */
export function monteCarlo(
  data: FinanceData,
  opts: { years?: number; sims?: number; seed?: number; extraMonthly?: number } = {},
): MonteCarloResult {
  const a = getAssumptions(data);
  const years = Math.max(1, opts.years ?? 25);
  const sims = opts.sims ?? 1000;
  const rand = mulberry32(opts.seed ?? 42);
  const s = summarize(data);
  const baseToNGN = (x: number) => toNGN(x, s.currency, a);
  const surplusNGN = Math.max(0, baseToNGN(s.monthlySurplus) + (opts.extraMonthly ?? 0)) * 12;

  const pots = data.investments.map((i) => ({
    usd: i.currency === "USD",
    value: Number(i.current_value) || 0, // in own currency
    yearly: (Number(i.monthly_contribution) || 0) * 12,
    mu: (Number(i.expected_return) || 0) / 100,
    sigma: (ASSET_VOLATILITY[i.asset_class] ?? 20) / 100,
  }));
  const debts = data.debts.map((d) => ({
    balance: toNGN(Number(d.balance), d.currency, a),
    r: (Number(d.interest_rate) || 0) / 100,
    pay: toNGN(Number(d.minimum_payment), d.currency, a) * 12,
  }));

  const buckets: { nominal: number[]; real: number[]; usd: number[] }[] = Array.from(
    { length: years + 1 },
    () => ({ nominal: [], real: [], usd: [] }),
  );

  for (let sim = 0; sim < sims; sim++) {
    const vals = pots.map((p) => p.value);
    const loans = debts.map((d) => d.balance);
    let cash = 0;
    let fx = a.rate;
    let cpi = 1;
    for (let y = 0; y <= years; y++) {
      if (y > 0) {
        fx *= Math.max(0.5, 1 + a.fxDepreciation + a.fxVolatility * normal(rand));
        cpi *= 1 + a.inflation;
        pots.forEach((p, k) => {
          const r = Math.max(-0.95, p.mu + p.sigma * normal(rand));
          vals[k] = vals[k]! * (1 + r) + p.yearly;
        });
        let freed = 0;
        debts.forEach((d, k) => {
          if (loans[k]! <= 0) {
            freed += d.pay;
            return;
          }
          loans[k] = loans[k]! * (1 + d.r) - d.pay;
          if (loans[k]! < 0) {
            freed += -loans[k]!;
            loans[k] = 0;
          }
        });
        cash = cash * (1 + a.inflation * 0.5) + surplusNGN * Math.pow(1 + a.salaryGrowth, y - 1) + freed;
      }
      const assets = vals.reduce((acc, v, k) => acc + (pots[k]!.usd ? v * fx : v), 0) + cash;
      const nw = assets - loans.reduce((x, b) => x + Math.max(0, b), 0);
      const bk = buckets[y]!;
      bk.nominal.push(nw);
      bk.real.push(nw / cpi);
      bk.usd.push(nw / fx);
    }
  }

  const thisYear = new Date().getFullYear();
  const age = data.profile?.age ?? null;
  const pct = (arr: number[]): [number, number, number] => {
    const sorted = [...arr].sort((x, y) => x - y);
    return [percentile(sorted, 10), percentile(sorted, 50), percentile(sorted, 90)];
  };
  return {
    sims,
    points: buckets.map((b, y) => ({
      yearOffset: y,
      year: thisYear + y,
      age: age != null ? age + y : null,
      nominal: pct(b.nominal),
      real: pct(b.real),
      usd: pct(b.usd),
    })),
    formula: `${sims} simulations. Each year: pot value × (1 + expected return ± volatility × random shock) + yearly contributions. USD pots are converted at a Naira rate that weakens ${(a.fxDepreciation * 100).toFixed(0)}%/yr on average (±15%). Monthly surplus is saved and grows with salary (${(a.salaryGrowth * 100).toFixed(0)}%/yr). Real = nominal ÷ (1 + ${(a.inflation * 100).toFixed(0)}% inflation)^years. Debts: balance × (1 + rate) − yearly payment.`,
  };
}

export function pickHorizons(data: FinanceData): number[] {
  const age = data.profile?.age;
  const ret = data.profile?.retirement_age;
  const hs = [1, 5, 10, 20];
  if (age && ret && ret > age && !hs.includes(ret - age)) hs.push(ret - age);
  return hs.sort((x, y) => x - y);
}
