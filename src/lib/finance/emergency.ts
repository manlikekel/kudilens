import { summarize, type FinanceData } from "./core";
import { getAssumptions, toNGN } from "./assumptions";

export interface EmergencyCheck {
  essentialMonthly: number;
  months: number;
  target: number;
  current: number;
  gap: number;
  formula: string;
}

/** Target = essential monthly costs × (3 base + 3 if income is variable + 1 per dependant, max 3). */
export function emergencyFund(data: FinanceData): EmergencyCheck {
  const a = getAssumptions(data);
  const s = summarize(data);
  const b = (x: number) => toNGN(x, s.currency, a);
  const essentialMonthly = b(s.monthlyExpenses + s.familyCost + s.minimumDebtPayments);
  const variable = a.incomeStability !== "stable" ? 3 : 0;
  const dep = Math.min(3, s.dependents);
  const months = 3 + variable + dep;
  const flagged = (data.accounts ?? []).filter((x) => x.is_emergency_fund);
  const cash = data.investments
    .filter((i) => i.asset_class === "cash")
    .reduce((t, i) => t + toNGN(i.current_value, i.currency, a), 0);
  // Prefer accounts marked as the emergency fund; fall back to the older profile figure.
  const current = flagged.length
    ? flagged.reduce((t, x) => t + toNGN(x.balance, x.currency, a), 0)
    : cash + b(Number(data.profile?.emergency_fund ?? 0));
  const target = essentialMonthly * months;
  return {
    essentialMonthly,
    months,
    target,
    current,
    gap: Math.max(0, target - current),
    formula: `Essential costs ${Math.round(essentialMonthly).toLocaleString()} ₦/month × ${months} months (3 base${variable ? " + 3 for variable income" : ""}${dep ? ` + ${dep} for dependants` : ""}).`,
  };
}

export interface ProtectionGap {
  kind: "life" | "health";
  needed: number;
  have: number;
  gap: number;
  formula: string;
}

export function protectionGaps(data: FinanceData): ProtectionGap[] {
  const a = getAssumptions(data);
  const s = summarize(data);
  const b = (x: number) => toNGN(x, s.currency, a);
  const lifeNeed = s.dependents > 0 ? b(s.monthlyIncome) * 12 * 10 + b(s.totalDebt) : b(s.totalDebt);
  const people = 1 + data.family.length;
  const healthNeed = people * 2_000_000;
  const life = b(Number(data.profile?.life_cover ?? 0));
  const health = b(Number(data.profile?.health_cover ?? 0));
  return [
    {
      kind: "life",
      needed: lifeNeed,
      have: life,
      gap: Math.max(0, lifeNeed - life),
      formula: s.dependents > 0 ? "10 × yearly income + all debts (you have dependants)." : "Enough to clear your debts.",
    },
    {
      kind: "health",
      needed: healthNeed,
      have: health,
      gap: Math.max(0, healthNeed - health),
      formula: `₦2m yearly cover × ${people} people in your household.`,
    },
  ];
}
