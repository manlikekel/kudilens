import { getRates, type FinanceData } from "./core";
import { simulatePayoff } from "./debt";
import { convert } from "./fx";
import { roundMoney } from "./money";

export interface DebtFreePlan {
  /** total monthly debt payments, base currency */
  monthlyPayment: number;
  totalDebt: number;
  /** months until every debt is cleared, or null if it never happens at this payment */
  months: number | null;
  debtFreeDate: Date | null;
  totalInterest: number;
  milestones: { id: string; name: string; months: number; date: Date }[];
}

const addMonths = (from: Date, n: number) => new Date(from.getFullYear(), from.getMonth() + n, 1);

/**
 * Debt-free countdown if the user keeps paying today's total monthly debt payments: each debt
 * gets its minimum, and once one is cleared its payment rolls onto the next (highest rate first).
 */
export function debtFreePlan(data: FinanceData, today = new Date()): DebtFreePlan {
  const base = data.profile?.base_currency ?? "NGN";
  const rates = getRates(data);
  const c = (x: number, cur: string) => convert(Number(x) || 0, cur, base, rates);
  const debts = data.debts
    .filter((d) => Number(d.balance) > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: c(d.balance, d.currency),
      rate: Number(d.interest_rate) || 0,
      minimum: c(d.minimum_payment, d.currency),
    }));
  const monthlyPayment = debts.reduce((t, d) => t + d.minimum, 0);
  const totalDebt = debts.reduce((t, d) => t + d.balance, 0);
  if (!debts.length)
    return {
      monthlyPayment: 0,
      totalDebt: 0,
      months: 0,
      debtFreeDate: today,
      totalInterest: 0,
      milestones: [],
    };

  const sim = simulatePayoff(debts, "avalanche", 0, [], 600);
  return {
    monthlyPayment: roundMoney(monthlyPayment),
    totalDebt: roundMoney(totalDebt),
    months: sim.finished ? sim.months : null,
    debtFreeDate: sim.finished ? addMonths(today, sim.months) : null,
    totalInterest: roundMoney(sim.totalInterest),
    milestones: sim.payoffOrder.map((p) => ({
      ...p,
      months: p.month,
      date: addMonths(today, p.month),
    })),
  };
}
