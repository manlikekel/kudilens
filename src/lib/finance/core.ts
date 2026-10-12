import { buildRates, convert, type FxRateRow, type FxRates } from "./fx";
import { roundMoney } from "./money";

export type Currency = "NGN" | "USD" | "GBP" | "EUR" | "CAD";

export interface Profile {
  id: string;
  full_name: string | null;
  age: number | null;
  retirement_age: number | null;
  base_currency: string;
  /** @deprecated replaced by fx_rates + fx_overrides */
  usd_ngn_rate?: number;
  inflation_rate: number;
  risk_tolerance: string;
  goals: string | null;
  fx_depreciation?: number;
  education_inflation?: number;
  salary_growth?: number;
  income_stability?: string;
  life_cover?: number;
  health_cover?: number;
  emergency_fund?: number;
  fx_overrides?: Record<string, unknown> | null;
  inflation_fx_correlation?: number;
  cash_yield_ratio?: number;
  foreign_inflation?: number;
  grow_contributions?: boolean;
}

export interface Debt {
  id: string;
  name: string;
  kind: string;
  balance: number;
  currency: string;
  interest_rate: number;
  minimum_payment: number;
  notes: string | null;
}

export interface Investment {
  id: string;
  name: string;
  asset_class: string;
  current_value: number;
  currency: string;
  monthly_contribution: number;
  expected_return: number;
  notes: string | null;
}

export interface CashFlow {
  id: string;
  label: string;
  flow_type: string;
  category: string;
  monthly_amount: number;
  currency: string;
  growth_rate: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  age: number;
  dependent: boolean;
  monthly_cost: number;
  currency: string;
}

export interface Account {
  id: string;
  name: string;
  kind: string; // bank | cash | wallet | domiciliary
  balance: number;
  currency: string;
  yield_rate?: number;
  is_emergency_fund: boolean;
}

export interface Asset {
  id: string;
  name: string;
  kind: string; // land | property | vehicle | pension | other
  current_value: number;
  currency: string;
  appreciation: number; // % per year
  liquid: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  currency: string;
  target_year: number;
  target_month?: number; // 1-12, default December
  current_saved: number;
  monthly_contribution: number;
  priority: number;
  saved_in?: string;
  goal_inflation?: number | null;
  linked_account_id?: string | null;
}

export interface LumpCost {
  id: string;
  label: string;
  amount: number;
  currency: string;
  /** 1-12 calendar months in which this cost is due each year */
  months: number[];
}

export interface FinanceData {
  profile: Profile | null;
  debts: Debt[];
  investments: Investment[];
  flows: CashFlow[];
  family: FamilyMember[];
  goals?: Goal[];
  lumps?: LumpCost[];
  accounts?: Account[];
  assets?: Asset[];
  fxRates?: FxRateRow[];
  /** Average actual monthly spending in Naira from imported transactions (excludes transfers, savings and debt repayments). */
  actualSpend?: { avgMonthly: number; months: number };
}

/** Official rates merged with the user's own overrides. */
export function getRates(data: FinanceData): FxRates {
  return buildRates(data.fxRates ?? [], (data.profile?.fx_overrides as Record<string, unknown>) ?? {});
}

/** Every currency referenced anywhere in the user's data. */
export function usedCurrencies(data: FinanceData): string[] {
  const all = [
    ...data.debts, ...data.investments, ...data.flows, ...data.family,
    ...(data.goals ?? []), ...(data.lumps ?? []), ...(data.accounts ?? []), ...(data.assets ?? []),
  ].map((x) => x.currency);
  return [...new Set(all)];
}

/** Investment classes that can be turned into cash within days. */
export const LIQUID_CLASSES = new Set(["cash", "money market", "t-bills"]);

export interface Summary {
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  familyCost: number;
  minimumDebtPayments: number;
  monthlyContributions: number;
  monthlySurplus: number;
  savingsRate: number;
  totalDebt: number;
  totalInvested: number;
  totalAccounts: number;
  totalAssets: number;
  liquidAssets: number;
  netWorth: number;
  weightedDebtRate: number;
  weightedReturn: number;
  runwayMonths: number;
  dependents: number;
}

export function summarize(data: FinanceData): Summary {
  const cur = data.profile?.base_currency ?? "NGN";
  const rates = getRates(data);
  const c = (amount: number, from: string) => convert(Number(amount), from, cur, rates);
  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0);

  const monthlyIncome = sum(data.flows.filter((f) => f.flow_type === "income"), (f) => c(f.monthly_amount, f.currency));
  const monthlyExpenses = sum(data.flows.filter((f) => f.flow_type === "expense"), (f) => c(f.monthly_amount, f.currency));
  const familyCost = sum(data.family, (m) => c(m.monthly_cost, m.currency));
  const minimumDebtPayments = sum(data.debts, (d) => c(d.minimum_payment, d.currency));
  const monthlyContributions = sum(data.investments, (i) => c(i.monthly_contribution, i.currency));
  const totalDebt = sum(data.debts, (d) => c(d.balance, d.currency));
  const totalInvested = sum(data.investments, (i) => c(i.current_value, i.currency));
  const totalAccounts = sum(data.accounts ?? [], (a) => c(a.balance, a.currency));
  const totalAssets = sum(data.assets ?? [], (a) => c(a.current_value, a.currency));
  const liquidAssets =
    totalAccounts +
    sum(data.investments.filter((i) => LIQUID_CLASSES.has(i.asset_class)), (i) => c(i.current_value, i.currency));

  const monthlySurplus = monthlyIncome - (monthlyExpenses + familyCost + minimumDebtPayments + monthlyContributions);
  const weightedDebtRate = totalDebt > 0 ? sum(data.debts, (d) => c(d.balance, d.currency) * Number(d.interest_rate)) / totalDebt : 0;
  const weightedReturn =
    totalInvested > 0 ? sum(data.investments, (i) => c(i.current_value, i.currency) * Number(i.expected_return)) / totalInvested : 0;
  const burn = monthlyExpenses + familyCost + minimumDebtPayments;

  return {
    currency: cur,
    monthlyIncome: roundMoney(monthlyIncome),
    monthlyExpenses: roundMoney(monthlyExpenses),
    familyCost: roundMoney(familyCost),
    minimumDebtPayments: roundMoney(minimumDebtPayments),
    monthlyContributions: roundMoney(monthlyContributions),
    monthlySurplus: roundMoney(monthlySurplus),
    savingsRate: monthlyIncome > 0 ? ((monthlyContributions + Math.max(monthlySurplus, 0)) / monthlyIncome) * 100 : 0,
    totalDebt: roundMoney(totalDebt),
    totalInvested: roundMoney(totalInvested),
    totalAccounts: roundMoney(totalAccounts),
    totalAssets: roundMoney(totalAssets),
    liquidAssets: roundMoney(liquidAssets),
    netWorth: roundMoney(totalAccounts + totalInvested + totalAssets - totalDebt),
    weightedDebtRate,
    weightedReturn,
    runwayMonths: burn > 0 ? liquidAssets / burn : 0,
    dependents: data.family.filter((m) => m.dependent).length,
  };
}
