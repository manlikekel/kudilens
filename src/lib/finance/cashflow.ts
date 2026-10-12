import { LIQUID_CLASSES, summarize, type FinanceData } from "./core";
import { getAssumptions, toNGN } from "./assumptions";

export interface CashMonth {
  label: string;
  month: number; // 1-12
  income: number;
  regular: number;
  lumps: { label: string; amount: number }[];
  net: number;
  balance: number;
  tight: boolean;
}

export interface CashForecast {
  months: CashMonth[];
  startBalance: number;
  sinkingFund: number; // monthly amount to set aside for lump sums
  sinkingBreakdown: { label: string; monthly: number }[];
  negativeMonths: number;
  usesActual: boolean;
  formula: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 12-month cash forecast in Naira, starting next month. */
export function forecastCash(data: FinanceData, start = new Date()): CashForecast {
  const a = getAssumptions(data);
  const s = summarize(data);
  const b = (x: number) => toNGN(x, s.currency, a);
  const income = b(s.monthlyIncome);
  const manualSpend = b(s.monthlyExpenses + s.familyCost);
  // Real spending from imported statements replaces the manual estimate once at least one full month exists.
  const usesActual = (data.actualSpend?.months ?? 0) > 0;
  const living = usesActual ? data.actualSpend!.avgMonthly : manualSpend;
  const regular = living + b(s.minimumDebtPayments + s.monthlyContributions);
  const cashPots = data.investments
    .filter((i) => LIQUID_CLASSES.has(i.asset_class))
    .reduce((t, i) => t + toNGN(i.current_value, i.currency, a), 0);
  const accounts = (data.accounts ?? []).reduce((t, x) => t + toNGN(x.balance, x.currency, a), 0);
  // Old profile "emergency fund" figure is used only when no accounts are recorded (avoids double counting).
  const startBalance = cashPots + (data.accounts?.length ? accounts : toNGN(Number(data.profile?.emergency_fund ?? 0), s.currency, a));

  const lumps = data.lumps ?? [];
  const sinkingBreakdown = lumps.map((l) => ({
    label: l.label,
    monthly: (toNGN(l.amount, l.currency, a) * (l.months?.length ?? 0)) / 12,
  }));
  const sinkingFund = sinkingBreakdown.reduce((t, x) => t + x.monthly, 0);

  let balance = startBalance;
  const months: CashMonth[] = [];
  for (let k = 1; k <= 12; k++) {
    const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
    const m = d.getMonth() + 1;
    const due = lumps
      .filter((l) => (l.months ?? []).includes(m))
      .map((l) => ({ label: l.label, amount: toNGN(l.amount, l.currency, a) }));
    const net = income - regular - due.reduce((t, x) => t + x.amount, 0);
    balance += net;
    months.push({
      label: `${MONTHS[m - 1]} ${String(d.getFullYear()).slice(2)}`,
      month: m,
      income,
      regular,
      lumps: due,
      net,
      balance,
      tight: net < 0 || balance < 0,
    });
  }
  return {
    months,
    startBalance,
    sinkingFund,
    sinkingBreakdown,
    negativeMonths: months.filter((m) => m.net < 0).length,
    usesActual,
    formula:
      (usesActual ? `Living costs use your actual average spending over the last ${data.actualSpend!.months} full month(s) from imported statements. ` : "") +
      "Each month: income − (expenses + family costs + minimum debt payments + investment contributions) − any lump sums due that month. Balance starts from your bank/cash accounts plus money-market and T-bill holdings. Sinking fund = sum of yearly lump sums ÷ 12.",
  };
}
