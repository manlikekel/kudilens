import { getRates, summarize, type FinanceData } from "./core";
import { convert } from "./fx";
import { roundMoney } from "./money";
import { CATEGORIES, detectRecurring, type Txn } from "./transactions";

type SpendTxn = Pick<Txn, "txn_date" | "amount_minor" | "category" | "currency" | "merchant">;

/** Categories that count as spending (not income, transfers, saving or debt repayment). */
export const SPEND_CATEGORIES = CATEGORIES.filter(
  (c) =>
    !["Salary", "Other income", "Transfers", "Savings & investing", "Debt repayment"].includes(c),
);
const SPEND = new Set<string>(SPEND_CATEGORIES);

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** This calendar month's spending per category, in the base currency (major units). */
export function monthSpend(data: FinanceData, txns: SpendTxn[], today = new Date()) {
  const base = data.profile?.base_currency ?? "NGN";
  const rates = getRates(data);
  const month = ym(today);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const t of txns) {
    if (t.amount_minor >= 0 || !t.txn_date.startsWith(month) || !SPEND.has(t.category)) continue;
    const v = convert(-t.amount_minor / 100, t.currency, base, rates);
    byCategory[t.category] = (byCategory[t.category] ?? 0) + v;
    total += v;
  }
  return { byCategory, total, hasData: txns.some((t) => t.txn_date.startsWith(month)) };
}

export interface SinkingFund {
  id: string;
  label: string;
  /** one payment, base currency */
  amount: number;
  /** total due across the year */
  perYear: number;
  /** set aside this much every month to cover the year */
  monthly: number;
  nextDue: Date;
  monthsUntil: number; // ≥ 1
  saved: number;
  /** what to put aside each month from now to have the next payment ready */
  neededPerMonth: number;
}

/**
 * Sinking funds for the yearly lump costs (school fees, rent, insurance...): put a little aside
 * every month so the big payment doesn't hit one month's budget.
 */
export function sinkingFunds(data: FinanceData, today = new Date()): SinkingFund[] {
  const base = data.profile?.base_currency ?? "NGN";
  const rates = getRates(data);
  return (data.lumps ?? [])
    .filter((l) => l.months?.length && Number(l.amount) > 0)
    .map((l) => {
      const amount = convert(Number(l.amount), l.currency, base, rates);
      const saved = convert(Number(l.saved ?? 0), l.currency, base, rates);
      const thisMonth = today.getMonth() + 1;
      const sorted = [...l.months].sort((a, b) => a - b);
      const nextMonth = sorted.find((m) => m > thisMonth) ?? sorted[0]!;
      const yearsAhead = nextMonth > thisMonth ? 0 : 1;
      const nextDue = new Date(today.getFullYear() + yearsAhead, nextMonth - 1, 1);
      const monthsUntil = Math.max(1, nextMonth - thisMonth + yearsAhead * 12);
      const perYear = amount * l.months.length;
      return {
        id: l.id,
        label: l.label,
        amount: roundMoney(amount),
        perYear: roundMoney(perYear),
        monthly: roundMoney(perYear / 12),
        nextDue,
        monthsUntil,
        saved: roundMoney(saved),
        neededPerMonth: roundMoney(Math.max(0, amount - saved) / monthsUntil),
      };
    })
    .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime());
}

export interface SafeToSpend {
  /** "live": from this month's imported transactions; "plan": from the amounts in My numbers */
  mode: "live" | "plan";
  income: number;
  debtPayments: number;
  investing: number;
  sinking: number;
  /** live: spent so far this month; plan: planned living and family costs */
  spending: number;
  /** recurring bills expected before month end that haven't gone out yet (live mode) */
  upcomingBills: number;
  bills: { merchant: string; amount: number; date: string }[];
  safe: number;
  daysLeft: number;
  perDay: number;
}

/**
 * What's left to spend this month after the things that must happen: debt payments, investing,
 * putting money aside for yearly costs, bills still to come, and what's already been spent.
 */
export function safeToSpend(data: FinanceData, txns: SpendTxn[], today = new Date()): SafeToSpend {
  const s = summarize(data);
  const base = s.currency;
  const rates = getRates(data);
  const sinking = sinkingFunds(data, today).reduce((t, f) => t + f.monthly, 0);
  const month = monthSpend(data, txns, today);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = monthEnd.getDate() - today.getDate() + 1;
  const prefix = ym(today);
  const todayIso = `${prefix}-${String(today.getDate()).padStart(2, "0")}`;
  const endIso = `${prefix}-${String(monthEnd.getDate()).padStart(2, "0")}`;

  let spending: number;
  let bills: SafeToSpend["bills"] = [];
  if (month.hasData) {
    spending = month.total;
    const paidThisMonth = new Set(
      txns
        .filter((t) => t.amount_minor < 0 && t.txn_date.startsWith(prefix))
        .map((t) => t.merchant.split(" ").slice(0, 2).join(" ")),
    );
    bills = detectRecurring(txns)
      .filter((r) => SPEND.has(r.category) && !paidThisMonth.has(r.merchant))
      .filter((r) => r.nextDate >= todayIso && r.nextDate <= endIso)
      .map((r) => ({
        merchant: r.merchant,
        amount: roundMoney(convert(r.typicalMinor / 100, "NGN", base, rates)),
        date: r.nextDate,
      }));
  } else {
    spending = s.monthlyExpenses + s.familyCost;
  }
  const upcomingBills = bills.reduce((t, b) => t + b.amount, 0);
  const safe =
    s.monthlyIncome -
    s.minimumDebtPayments -
    s.monthlyContributions -
    sinking -
    spending -
    upcomingBills;
  return {
    mode: month.hasData ? "live" : "plan",
    income: roundMoney(s.monthlyIncome),
    debtPayments: roundMoney(s.minimumDebtPayments),
    investing: roundMoney(s.monthlyContributions),
    sinking: roundMoney(sinking),
    spending: roundMoney(spending),
    upcomingBills: roundMoney(upcomingBills),
    bills,
    safe: roundMoney(safe),
    daysLeft,
    perDay: roundMoney(Math.max(0, safe) / daysLeft),
  };
}
