import { summarize, type FinanceData } from "./core";
import { emergencyFund } from "./emergency";
import { analyzeGoals } from "./goals";
import { getAssumptions, toNGN } from "./assumptions";
import { formatMoney } from "./fx";

export interface HealthPart {
  key: "saving" | "debt" | "buffer" | "goals" | "growth";
  label: string;
  points: number; // 0..20
  /** what the score is based on, in plain words */
  status: string;
  /** the single most useful step to raise this part; null when it's already maxed */
  tip: string | null;
}

export interface HealthReport {
  score: number; // 0..100
  grade: "Excellent" | "Good" | "Fair" | "Needs work";
  parts: HealthPart[];
  /** the part with the most points to gain, to lead with */
  focus: HealthPart | null;
}

const clamp = (x: number) => Math.max(0, Math.min(20, x));

/**
 * Financial health out of 100: five equal parts worth 20 each.
 *  - Saving: 20% of income saved or invested scores full marks
 *  - Debt: payments under 10% of income score full marks, 50% or more scores none
 *  - Safety buffer: emergency savings against the recommended months of costs
 *  - Goals: average chance of reaching them on time (no goals yet scores 10)
 *  - Growth: expected investment return after inflation (5% real or more scores full marks)
 */
export function healthReport(data: FinanceData): HealthReport {
  const s = summarize(data);
  const a = getAssumptions(data);
  const cur = s.currency;
  const m = (n: number) => formatMoney(n, cur);
  const parts: HealthPart[] = [];

  // saving (savingsRate is already a percentage)
  const rate = s.savingsRate;
  const savingPts = clamp((rate / 20) * 20);
  const toTwenty = Math.max(
    0,
    s.monthlyIncome * 0.2 - (s.monthlyContributions + Math.max(0, s.monthlySurplus)),
  );
  parts.push({
    key: "saving",
    label: "Saving",
    points: savingPts,
    status: `You save or invest ${rate.toFixed(0)}% of your income.`,
    tip: savingPts >= 20 ? null : `Put aside about ${m(toTwenty)} more a month to reach 20%.`,
  });

  // debt load
  const dti =
    s.monthlyIncome > 0
      ? s.minimumDebtPayments / s.monthlyIncome
      : s.minimumDebtPayments > 0
        ? 1
        : 0;
  const debtPts = clamp(((0.5 - dti) / 0.4) * 20);
  parts.push({
    key: "debt",
    label: "Debt",
    points: debtPts,
    status:
      s.totalDebt > 0
        ? `Debt payments take ${(dti * 100).toFixed(0)}% of your income.`
        : "You have no debts.",
    tip:
      debtPts >= 20
        ? null
        : `Get debt payments under 10% of income (${m(s.monthlyIncome * 0.1)} a month): clear the smallest or highest-rate debt first, and avoid new credit.`,
  });

  // safety buffer
  const ef = emergencyFund(data);
  const cover = ef.target > 0 ? ef.current / ef.target : 1;
  const bufferPts = clamp(cover * 20);
  const gapBase = ef.gap / Math.max(1e-9, toNGN(1, cur, a));
  parts.push({
    key: "buffer",
    label: "Safety buffer",
    points: bufferPts,
    status: `Emergency savings cover ${(cover * ef.months).toFixed(1)} months of essential costs (${ef.months} recommended for you).`,
    tip:
      bufferPts >= 20
        ? null
        : `Build your emergency fund by ${m(gapBase)} in a money market fund, and mark that account as your emergency fund in My numbers.`,
  });

  // goals
  const goals = analyzeGoals(data);
  const avg = goals.length ? goals.reduce((t, g) => t + g.probability, 0) / goals.length : null;
  const behind = goals
    .filter((g) => g.probability < 0.5)
    .sort((x, y) => x.probability - y.probability)[0];
  parts.push({
    key: "goals",
    label: "Goals",
    points: avg == null ? 10 : clamp(avg * 20),
    status:
      avg == null
        ? "You haven't set any goals yet."
        : `Your goals are ${(avg * 100).toFixed(0)}% likely on average.`,
    tip:
      avg == null
        ? "Add a goal (home, school fees, relocation) so you can plan for it."
        : behind
          ? `"${behind.goal.name}" is unlikely at today's pace: save about ${m(behind.required.p75 / Math.max(1e-9, toNGN(1, cur, a)))} a month for it.`
          : avg >= 0.95
            ? null
            : "Add a little to each goal every month to make them safe bets.",
  });

  // growth after inflation
  const real = s.totalInvested > 0 ? (1 + s.weightedReturn / 100) / (1 + a.inflation) - 1 : null;
  const growthPts = real == null ? 0 : clamp((real / 0.05) * 20);
  parts.push({
    key: "growth",
    label: "Growth",
    points: growthPts,
    status:
      real == null
        ? "You don't have investments yet."
        : `Your investments are expected to grow ${(real * 100).toFixed(1)}% a year after inflation.`,
    tip:
      growthPts >= 20
        ? null
        : real == null
          ? "Start investing a fixed amount each month, even a small one."
          : "Move long-term money into funds that beat inflation, and check fees.",
  });

  const score = Math.round(parts.reduce((t, p) => t + p.points, 0));
  const focus = [...parts].filter((p) => p.tip).sort((x, y) => x.points - y.points)[0] ?? null;
  return {
    score,
    grade: score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs work",
    parts: parts.map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 })),
    focus,
  };
}
