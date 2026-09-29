export type Strategy = "avalanche" | "snowball" | "custom";

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  rate: number; // % per year
  minimum: number; // monthly
}

export interface PayoffResult {
  strategy: Strategy;
  months: number;
  totalInterest: number;
  payoffOrder: { id: string; name: string; month: number }[];
  timeline: { month: number; balance: number }[];
  finished: boolean;
}

export function orderDebts(debts: DebtInput[], strategy: Strategy, custom: string[] = []): DebtInput[] {
  const copy = [...debts];
  if (strategy === "avalanche") return copy.sort((a, b) => b.rate - a.rate);
  if (strategy === "snowball") return copy.sort((a, b) => a.balance - b.balance);
  const idx = (id: string) => {
    const i = custom.indexOf(id);
    return i === -1 ? 999 : i;
  };
  return copy.sort((a, b) => idx(a.id) - idx(b.id));
}

/**
 * Month-by-month payoff: interest accrues, every debt gets its minimum, then the
 * extra (plus minimums freed from cleared debts) goes to the first debt in order.
 */
export function simulatePayoff(
  debts: DebtInput[],
  strategy: Strategy,
  extra = 0,
  custom: string[] = [],
  maxMonths = 600,
): PayoffResult {
  const ordered = orderDebts(debts, strategy, custom).map((d) => ({ ...d }));
  const budget = ordered.reduce((s, d) => s + d.minimum, 0) + Math.max(0, extra);
  let totalInterest = 0;
  const payoffOrder: PayoffResult["payoffOrder"] = [];
  const timeline = [{ month: 0, balance: ordered.reduce((s, d) => s + d.balance, 0) }];
  let month = 0;
  while (ordered.some((d) => d.balance > 0.01) && month < maxMonths) {
    month++;
    for (const d of ordered) {
      if (d.balance <= 0) continue;
      const i = d.balance * (d.rate / 100 / 12);
      d.balance += i;
      totalInterest += i;
    }
    let pot = budget;
    for (const d of ordered) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minimum, d.balance, pot);
      d.balance -= pay;
      pot -= pay;
    }
    for (const d of ordered) {
      if (pot <= 0) break;
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, pot);
      d.balance -= pay;
      pot -= pay;
    }
    for (const d of ordered) {
      if (d.balance <= 0.01 && !payoffOrder.some((p) => p.id === d.id)) {
        d.balance = 0;
        payoffOrder.push({ id: d.id, name: d.name, month });
      }
    }
    timeline.push({ month, balance: ordered.reduce((s, d) => s + Math.max(0, d.balance), 0) });
  }
  return {
    strategy,
    months: month,
    totalInterest,
    payoffOrder,
    timeline,
    finished: !ordered.some((d) => d.balance > 0.01),
  };
}

/** Debts whose rate beats the portfolio's expected return: pay these before investing more. */
export function debtsAboveReturn(debts: DebtInput[], portfolioReturn: number): DebtInput[] {
  return debts.filter((d) => d.balance > 0 && d.rate > portfolioReturn);
}
