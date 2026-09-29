import { summarize, type FinanceData, type Goal } from "./core";
import { getAssumptions, toNGN, type Assumptions } from "./assumptions";
import { mulberry32, normal } from "./rng";

export interface GoalAnalysis {
  goal: Goal;
  years: number;
  targetNGN: number; // future cost in Naira (USD goals include FX drift)
  probability: number; // 0..1
  required: { p50: number; p75: number; p90: number }; // monthly NGN
  formula: string;
}

const GOAL_RETURN = 0.18; // balanced Naira portfolio
const GOAL_VOL = 0.12;

/** Probability that savings reach the target by the target year. */
export function goalProbability(
  startNGN: number,
  monthlyNGN: number,
  targetNGN: number,
  years: number,
  opts: { sims?: number; seed?: number; mu?: number; sigma?: number } = {},
): number {
  if (years <= 0) return startNGN >= targetNGN ? 1 : 0;
  const sims = opts.sims ?? 1000;
  const rand = mulberry32(opts.seed ?? 7);
  const mu = opts.mu ?? GOAL_RETURN;
  const sigma = opts.sigma ?? GOAL_VOL;
  let hits = 0;
  for (let s = 0; s < sims; s++) {
    let v = startNGN;
    for (let y = 0; y < years; y++) v = v * (1 + mu + sigma * normal(rand)) + monthlyNGN * 12;
    if (v >= targetNGN) hits++;
  }
  return hits / sims;
}

/** Bisection for the monthly contribution that achieves a probability target. */
export function requiredMonthly(
  startNGN: number,
  targetNGN: number,
  years: number,
  prob: number,
): number {
  if (years <= 0) return Math.max(0, targetNGN - startNGN);
  let lo = 0;
  let hi = Math.max(1, targetNGN / (years * 12)) * 3;
  if (goalProbability(startNGN, 0, targetNGN, years) >= prob) return 0;
  while (goalProbability(startNGN, hi, targetNGN, years, { sims: 400 }) < prob) hi *= 2;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (goalProbability(startNGN, mid, targetNGN, years, { sims: 400 }) >= prob) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function goalTargetNGN(goal: Goal, years: number, a: Assumptions): number {
  const base = toNGN(Number(goal.target_amount), goal.currency, a);
  // USD-priced goals get more expensive in Naira as the currency weakens.
  return goal.currency === "USD" ? base * Math.pow(1 + a.fxDepreciation, years) : base;
}

export function analyzeGoals(data: FinanceData): GoalAnalysis[] {
  const a = getAssumptions(data);
  const year = new Date().getFullYear();
  return (data.goals ?? []).map((goal) => {
    const years = Math.max(0, goal.target_year - year);
    const targetNGN = goalTargetNGN(goal, years, a);
    const start = toNGN(Number(goal.current_saved), goal.currency, a);
    const monthly = toNGN(Number(goal.monthly_contribution), goal.currency, a);
    return {
      goal,
      years,
      targetNGN,
      probability: goalProbability(start, monthly, targetNGN, years),
      required: {
        p50: requiredMonthly(start, targetNGN, years, 0.5),
        p75: requiredMonthly(start, targetNGN, years, 0.75),
        p90: requiredMonthly(start, targetNGN, years, 0.9),
      },
      formula: `1,000 simulations over ${years} yr: savings × (1 + 18% ± 12%) + monthly × 12 each year; probability = share of runs ending ≥ ${Math.round(targetNGN).toLocaleString()} NGN.${goal.currency === "USD" ? ` Target grows with Naira depreciation (${(a.fxDepreciation * 100).toFixed(0)}%/yr).` : ""}`,
    };
  });
}

export interface Competition {
  competing: boolean;
  needed: number;
  available: number;
  order: GoalAnalysis[];
}

/** Goals compete when combined 75%-probability contributions exceed free monthly surplus. */
export function goalCompetition(data: FinanceData, analyses: GoalAnalysis[]): Competition {
  const a = getAssumptions(data);
  const s = summarize(data);
  const available = Math.max(0, toNGN(s.monthlySurplus, s.currency, a));
  const needed = analyses.reduce(
    (t, g) => t + Math.max(0, g.required.p75 - toNGN(g.goal.monthly_contribution, g.goal.currency, a)),
    0,
  );
  const order = [...analyses].sort(
    (x, y) => x.goal.priority - y.goal.priority || x.years - y.years,
  );
  return { competing: needed > available, needed, available, order };
}
