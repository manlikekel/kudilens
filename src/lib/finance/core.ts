export type Currency = "NGN" | "USD";

export interface Profile {
  id: string;
  full_name: string | null;
  age: number | null;
  retirement_age: number | null;
  base_currency: string;
  usd_ngn_rate: number;
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

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  currency: string;
  target_year: number;
  current_saved: number;
  monthly_contribution: number;
  priority: number;
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
  goals?: Goal[];
  lumps?: LumpCost[];
  profile: Profile | null;
  debts: Debt[];
  investments: Investment[];
  flows: CashFlow[];
  family: FamilyMember[];
}

/** Convert any stored amount into the user's display currency. */
export function convert(
  amount: number,
  from: string,
  to: string,
  usdNgnRate: number,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  const rate = usdNgnRate > 0 ? usdNgnRate : 1;
  if (from === "USD" && to === "NGN") return amount * rate;
  if (from === "NGN" && to === "USD") return amount / rate;
  return amount;
}

export function formatMoney(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const symbol = currency === "USD" ? "$" : "₦";
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

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
  netWorth: number;
  weightedDebtRate: number;
  weightedReturn: number;
  runwayMonths: number;
  dependents: number;
}

export function summarize(data: FinanceData): Summary {
  const p = data.profile;
  const cur = p?.base_currency ?? "NGN";
  const rate = p?.usd_ngn_rate ?? 1500;
  const c = (amount: number, from: string) => convert(amount, from, cur, rate);

  const monthlyIncome = data.flows
    .filter((f) => f.flow_type === "income")
    .reduce((s, f) => s + c(Number(f.monthly_amount), f.currency), 0);
  const monthlyExpenses = data.flows
    .filter((f) => f.flow_type === "expense")
    .reduce((s, f) => s + c(Number(f.monthly_amount), f.currency), 0);
  const familyCost = data.family.reduce(
    (s, m) => s + c(Number(m.monthly_cost), m.currency),
    0,
  );
  const minimumDebtPayments = data.debts.reduce(
    (s, d) => s + c(Number(d.minimum_payment), d.currency),
    0,
  );
  const monthlyContributions = data.investments.reduce(
    (s, i) => s + c(Number(i.monthly_contribution), i.currency),
    0,
  );
  const totalDebt = data.debts.reduce((s, d) => s + c(Number(d.balance), d.currency), 0);
  const totalInvested = data.investments.reduce(
    (s, i) => s + c(Number(i.current_value), i.currency),
    0,
  );

  const outgoings = monthlyExpenses + familyCost + minimumDebtPayments + monthlyContributions;
  const monthlySurplus = monthlyIncome - outgoings;

  const weightedDebtRate =
    totalDebt > 0
      ? data.debts.reduce(
          (s, d) => s + c(Number(d.balance), d.currency) * Number(d.interest_rate),
          0,
        ) / totalDebt
      : 0;
  const weightedReturn =
    totalInvested > 0
      ? data.investments.reduce(
          (s, i) => s + c(Number(i.current_value), i.currency) * Number(i.expected_return),
          0,
        ) / totalInvested
      : 0;

  const burn = monthlyExpenses + familyCost + minimumDebtPayments;
  return {
    currency: cur,
    monthlyIncome,
    monthlyExpenses,
    familyCost,
    minimumDebtPayments,
    monthlyContributions,
    monthlySurplus,
    savingsRate:
      monthlyIncome > 0 ? ((monthlyContributions + Math.max(monthlySurplus, 0)) / monthlyIncome) * 100 : 0,
    totalDebt,
    totalInvested,
    netWorth: totalInvested - totalDebt,
    weightedDebtRate,
    weightedReturn,
    runwayMonths: burn > 0 ? totalInvested / burn : 0,
    dependents: data.family.filter((m) => m.dependent).length,
  };
}

export interface ProjectionPoint {
  year: number;
  age: number | null;
  investments: number;
  debt: number;
  netWorth: number;
  realNetWorth: number;
}

/** Month-by-month simulation of investments, debts and surplus. */
export function project(data: FinanceData, years = 25, extraMonthly = 0): ProjectionPoint[] {
  const p = data.profile;
  const cur = p?.base_currency ?? "NGN";
  const rate = p?.usd_ngn_rate ?? 1500;
  const inflation = (p?.inflation_rate ?? 0) / 100;
  const c = (amount: number, from: string) => convert(amount, from, cur, rate);

  let pots = data.investments.map((i) => ({
    value: c(Number(i.current_value), i.currency),
    monthly: c(Number(i.monthly_contribution), i.currency),
    r: Number(i.expected_return) / 100 / 12,
  }));
  let loans = data.debts.map((d) => ({
    balance: c(Number(d.balance), d.currency),
    payment: c(Number(d.minimum_payment), d.currency),
    r: Number(d.interest_rate) / 100 / 12,
  }));

  const s = summarize(data);
  const points: ProjectionPoint[] = [];
  const startAge = p?.age ?? null;
  const thisYear = new Date().getFullYear();

  const push = (yearOffset: number) => {
    const investments = pots.reduce((a, b) => a + b.value, 0);
    const debt = loans.reduce((a, b) => a + Math.max(b.balance, 0), 0);
    const netWorth = investments - debt;
    points.push({
      year: thisYear + yearOffset,
      age: startAge !== null ? startAge + yearOffset : null,
      investments: Math.round(investments),
      debt: Math.round(debt),
      netWorth: Math.round(netWorth),
      realNetWorth: Math.round(netWorth / Math.pow(1 + inflation, yearOffset)),
    });
  };

  push(0);
  let freeCash = Math.max(s.monthlySurplus, 0) + extraMonthly;

  for (let m = 1; m <= years * 12; m++) {
    // debts: interest then payment (freed payments roll into free cash)
    loans = loans.map((l) => {
      if (l.balance <= 0) return l;
      const balance = l.balance * (1 + l.r) - l.payment;
      return { ...l, balance: Math.max(balance, 0) };
    });
    const clearedPayments = loans
      .filter((l) => l.balance <= 0)
      .reduce((a, b) => a + b.payment, 0);

    // investments grow, receive contributions plus surplus split evenly
    const spare = freeCash + clearedPayments;
    const share = pots.length > 0 ? spare / pots.length : 0;
    pots = pots.map((pot) => ({
      ...pot,
      value: pot.value * (1 + pot.r) + pot.monthly + share,
    }));

    if (m % 12 === 0) push(m / 12);
  }
  return points;
}

export interface Insight {
  id: string;
  severity: "critical" | "watch" | "good";
  title: string;
  detail: string;
  action: string;
}

export function buildInsights(data: FinanceData): Insight[] {
  const s = summarize(data);
  const cur = s.currency;
  const out: Insight[] = [];
  const money = (n: number) => formatMoney(n, cur);

  if (s.monthlyIncome === 0) {
    out.push({
      id: "no-income",
      severity: "watch",
      title: "No income recorded yet",
      detail: "Projections stay flat until monthly income is entered.",
      action: "Add your salary or business income under Income & spending.",
    });
  }

  if (s.monthlySurplus < 0) {
    out.push({
      id: "deficit",
      severity: "critical",
      title: `You are ${money(Math.abs(s.monthlySurplus))} short every month`,
      detail:
        "Outgoings (living costs, family, debt payments and contributions) exceed income, so debt or savings are being drained.",
      action: `Cut ${money(Math.abs(s.monthlySurplus))} of monthly spending or pause part of your contributions until income rises.`,
    });
  } else if (s.monthlyIncome > 0 && s.savingsRate < 10) {
    out.push({
      id: "low-savings",
      severity: "watch",
      title: `Savings rate is only ${s.savingsRate.toFixed(0)}%`,
      detail: "Below 10% makes long-term goals very slow to reach.",
      action: `Target at least ${money(s.monthlyIncome * 0.15)} per month set aside.`,
    });
  } else if (s.savingsRate >= 20) {
    out.push({
      id: "strong-savings",
      severity: "good",
      title: `Strong savings rate of ${s.savingsRate.toFixed(0)}%`,
      detail: "You are compounding faster than most households at your income level.",
      action: "Keep it steady and review your asset mix once a year.",
    });
  }

  const expensive = data.debts
    .filter((d) => Number(d.interest_rate) > 0)
    .sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate))[0];
  if (expensive && Number(expensive.interest_rate) > s.weightedReturn) {
    out.push({
      id: "debt-vs-return",
      severity: "critical",
      title: `${expensive.name} costs ${Number(expensive.interest_rate).toFixed(1)}% — more than your investments earn`,
      detail: `Your investments are expected to return about ${s.weightedReturn.toFixed(1)}% a year, so every spare naira put here beats investing it.`,
      action: `Direct spare cash to ${expensive.name} first (avalanche method), then move to the next highest rate.`,
    });
  }

  if (s.totalDebt > 0 && s.monthlyIncome > 0) {
    const dti = (s.minimumDebtPayments / s.monthlyIncome) * 100;
    if (dti > 36) {
      out.push({
        id: "dti",
        severity: "critical",
        title: `Debt payments take ${dti.toFixed(0)}% of income`,
        detail: "Above 36% is where lenders and cash flow start to break down.",
        action: "Refinance or extend the highest-payment loan, and avoid new credit for now.",
      });
    }
  }

  if (s.runwayMonths < 3) {
    out.push({
      id: "runway",
      severity: s.runwayMonths < 1 ? "critical" : "watch",
      title: `Emergency buffer covers ${s.runwayMonths.toFixed(1)} months`,
      detail: `With ${s.dependents} dependent(s), a 6-month buffer is the safe level.`,
      action: `Build a cash reserve of about ${money((s.monthlyExpenses + s.familyCost + s.minimumDebtPayments) * 6)}.`,
    });
  }

  const classes = new Map<string, number>();
  for (const i of data.investments) {
    const v = convert(
      Number(i.current_value),
      i.currency,
      cur,
      data.profile?.usd_ngn_rate ?? 1500,
    );
    classes.set(i.asset_class, (classes.get(i.asset_class) ?? 0) + v);
  }
  if (s.totalInvested > 0) {
    for (const [cls, v] of classes) {
      const share = (v / s.totalInvested) * 100;
      if (share > 60) {
        out.push({
          id: `concentration-${cls}`,
          severity: "watch",
          title: `${share.toFixed(0)}% of your portfolio sits in ${cls}`,
          detail: "One bad year in a single asset class would hit your whole plan.",
          action: `Send new contributions into other assets until ${cls} is under 50%.`,
        });
      }
    }
    const usdShare =
      data.investments
        .filter((i) => i.currency === "USD")
        .reduce((a, b) => a + convert(Number(b.current_value), "USD", cur, data.profile?.usd_ngn_rate ?? 1500), 0) /
      s.totalInvested;
    if (usdShare < 0.3) {
      out.push({
        id: "fx",
        severity: "watch",
        title: `Only ${(usdShare * 100).toFixed(0)}% of your assets are in USD`,
        detail: `With naira inflation assumed at ${(data.profile?.inflation_rate ?? 0).toFixed(0)}%, local-currency savings lose real value.`,
        action: "Hold part of long-term savings in dollar assets to protect purchasing power.",
      });
    }
  }

  const teens = data.family.filter((m) => m.dependent && m.age >= 10 && m.age <= 17);
  if (teens.length > 0) {
    out.push({
      id: "education",
      severity: "watch",
      title: `${teens.length} child(ren) reach university age within ${18 - Math.max(...teens.map((t) => t.age))}–8 years`,
      detail: "Education bills land as a lump sum and usually break an otherwise healthy plan.",
      action: "Start a separate education pot now so tuition is not funded from debt later.",
    });
  }

  if (data.profile?.age && data.profile.retirement_age) {
    const yearsLeft = data.profile.retirement_age - data.profile.age;
    const at = project(data, Math.max(yearsLeft, 1)).at(-1);
    if (at) {
      const needed = (s.monthlyExpenses + s.familyCost) * 12 * 25;
      out.push({
        id: "retirement",
        severity: at.netWorth >= needed ? "good" : "watch",
        title:
          at.netWorth >= needed
            ? `On track: about ${money(at.netWorth)} by age ${data.profile.retirement_age}`
            : `Projected shortfall at age ${data.profile.retirement_age}`,
        detail: `Projected net worth ${money(at.netWorth)} against roughly ${money(needed)} needed to live on today's spending.`,
        action:
          at.netWorth >= needed
            ? "You could consider retiring earlier or raising your lifestyle target."
            : `Increase monthly investing by about ${money(Math.max((needed - at.netWorth) / Math.max(yearsLeft * 12, 1), 0))} to close the gap.`,
      });
    }
  }

  return out;
}
