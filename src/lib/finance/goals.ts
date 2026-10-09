import { summarize, type FinanceData, type Goal } from "./core";
import { getAssumptions, toNGN, type Assumptions } from "./assumptions";
import { mulberry32, normal } from "./rng";

/** Where goal money is kept, with its expected return and volatility (annual, in its own currency). */
export const SAVINGS_VEHICLES: Record<string, { mu: number; sigma: number; currency: string; label: string }> = {
  "money market": { mu: 0.18, sigma: 0.02, currency: "NGN", label: "Money market fund" },
  "t-bills": { mu: 0.2, sigma: 0.01, currency: "NGN", label: "Treasury bills" },
  "savings account": { mu: 0.08, sigma: 0.005, currency: "NGN", label: "Bank savings" },
  bonds: { mu: 0.17, sigma: 0.06, currency: "NGN", label: "FGN bonds" },
  stocks: { mu: 0.22, sigma: 0.25, currency: "NGN", label: "NGX stocks" },
  "usd eurobond": { mu: 0.07, sigma: 0.06, currency: "USD", label: "Dollar Eurobond fund" },
  "usd savings": { mu: 0.03, sigma: 0.01, currency: "USD", label: "Dollar savings / dom account" },
};

export interface GoalAnalysis {
  goal: Goal;
  months: number;
  years: number; // months / 12, may be fractional
  targetNGN: number; // future cost in Naira
  startNGN: number;
  probability: number; // 0..1
  required: { p50: number; p75: number; p90: number }; // monthly NGN
  formula: string;
}

const SIMS = 1000;
const SEED = 7;

/** Naira return/volatility of the vehicle (foreign vehicles also gain the Naira's fall). */
export function vehicleReturn(savedIn: string | undefined, a: Assumptions): { mu: number; sigma: number } {
  const v = SAVINGS_VEHICLES[savedIn ?? "money market"] ?? SAVINGS_VEHICLES["money market"]!;
  if (v.currency === "NGN") return { mu: v.mu, sigma: v.sigma };
  return { mu: (1 + v.mu) * (1 + a.fxDepreciation) - 1, sigma: Math.sqrt(v.sigma ** 2 + a.fxVolatility ** 2) };
}

/** Months from `now` until the end of the goal's target month. */
export function monthsUntil(goal: Goal, now = new Date()): number {
  const m = (goal.target_year - now.getFullYear()) * 12 + ((goal.target_month ?? 12) - (now.getMonth() + 1));
  return Math.max(0, m);
}

/** Probability that savings reach the target, simulated month by month with lognormal returns. */
export function goalProbability(
  startNGN: number,
  monthlyNGN: number,
  targetNGN: number,
  months: number,
  opts: { sims?: number; seed?: number; mu?: number; sigma?: number } = {},
): number {
  if (months <= 0) return startNGN >= targetNGN ? 1 : 0;
  const sims = opts.sims ?? SIMS;
  const rand = mulberry32(opts.seed ?? SEED);
  const mu = Math.log(1 + (opts.mu ?? 0.18)) / 12;
  const sg = (opts.sigma ?? 0.02) / Math.sqrt(12);
  let hits = 0;
  for (let s = 0; s < sims; s++) {
    let v = startNGN;
    for (let m = 0; m < months; m++) v = v * Math.exp(mu - (sg * sg) / 2 + sg * normal(rand)) + monthlyNGN;
    if (v >= targetNGN) hits++;
  }
  return hits / sims;
}

/** Bisection with a fixed seed and 1,000 sims, so the answer is stable between renders. */
export function requiredMonthly(
  startNGN: number,
  targetNGN: number,
  months: number,
  prob: number,
  opts: { mu?: number; sigma?: number } = {},
): number {
  if (months <= 0) return Math.max(0, targetNGN - startNGN);
  const p = (x: number) => goalProbability(startNGN, x, targetNGN, months, opts);
  if (p(0) >= prob) return 0;
  let lo = 0;
  let hi = Math.max(1, targetNGN / months);
  while (p(hi) < prob) hi *= 2;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (p(mid) >= prob) hi = mid;
    else lo = mid;
  }
  return Math.round(hi);
}

/**
 * Future Naira cost. NGN goals inflate with general (or goal-specific) inflation.
 * Foreign goals inflate with foreign inflation, then convert at the depreciated Naira rate.
 */
export function goalTargetNGN(goal: Goal, months: number, a: Assumptions): number {
  const t = months / 12;
  if (goal.currency === "NGN") {
    const inf = goal.goal_inflation != null ? Number(goal.goal_inflation) / 100 : a.inflation;
    return Number(goal.target_amount) * Math.pow(1 + inf, t);
  }
  const foreign = Number(goal.target_amount) * Math.pow(1 + a.foreignInflation, t);
  return toNGN(foreign, goal.currency, a) * Math.pow(1 + a.fxDepreciation, t);
}

/** Starting savings: the linked account's balance if linked (so it isn't counted twice). */
export function goalStartNGN(goal: Goal, data: FinanceData, a: Assumptions): number {
  const acct = goal.linked_account_id ? (data.accounts ?? []).find((x) => x.id === goal.linked_account_id) : undefined;
  if (acct) return toNGN(acct.balance, acct.currency, a);
  return toNGN(Number(goal.current_saved), goal.currency, a);
}

export function analyzeGoals(data: FinanceData, now = new Date()): GoalAnalysis[] {
  const a = getAssumptions(data);
  return (data.goals ?? []).map((goal) => {
    const months = monthsUntil(goal, now);
    const targetNGN = goalTargetNGN(goal, months, a);
    const startNGN = goalStartNGN(goal, data, a);
    const monthly = toNGN(Number(goal.monthly_contribution), goal.currency, a);
    const v = vehicleReturn(goal.saved_in, a);
    const veh = SAVINGS_VEHICLES[goal.saved_in ?? "money market"]?.label ?? "Money market fund";
    const inf = goal.currency === "NGN"
      ? `${goal.goal_inflation != null ? Number(goal.goal_inflation) : (a.inflation * 100).toFixed(0)}%/yr inflation`
      : `${(a.foreignInflation * 100).toFixed(0)}% ${goal.currency} inflation, converted at a Naira rate weakening ${(a.fxDepreciation * 100).toFixed(0)}%/yr`;
    return {
      goal,
      months,
      years: months / 12,
      targetNGN: Math.round(targetNGN),
      startNGN: Math.round(startNGN),
      probability: goalProbability(startNGN, monthly, targetNGN, months, v),
      required: {
        p50: requiredMonthly(startNGN, targetNGN, months, 0.5, v),
        p75: requiredMonthly(startNGN, targetNGN, months, 0.75, v),
        p90: requiredMonthly(startNGN, targetNGN, months, 0.9, v),
      },
      formula: `Target grown by ${inf} over ${months} months = ${Math.round(targetNGN).toLocaleString()} NGN. Savings kept in ${veh} (≈${(v.mu * 100).toFixed(0)}% ± ${(v.sigma * 100).toFixed(0)}% a year in Naira terms), simulated month by month 1,000 times; probability = share of runs that reach the target.`,
    };
  });
}

export interface Competition {
  competing: boolean;
  needed: number;
  available: number;
  order: GoalAnalysis[];
}

/** Goals compete when combined 75%-probability top-ups exceed the free monthly surplus. */
export function goalCompetition(data: FinanceData, analyses: GoalAnalysis[]): Competition {
  const a = getAssumptions(data);
  const s = summarize(data);
  const available = Math.max(0, toNGN(s.monthlySurplus, s.currency, a));
  const needed = analyses.reduce(
    (t, g) => t + Math.max(0, g.required.p75 - toNGN(g.goal.monthly_contribution, g.goal.currency, a)),
    0,
  );
  const order = [...analyses].sort((x, y) => x.goal.priority - y.goal.priority || x.months - y.months);
  return { competing: needed > available, needed, available, order };
}
