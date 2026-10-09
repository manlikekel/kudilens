import { getRates, summarize, type FinanceData } from "./core";
import { convert, formatMoney } from "./fx";
import { project } from "./engine";

/** Debts whose minimum payment doesn't even cover the monthly interest. */
export function nonAmortisingDebts(data: FinanceData) {
  return data.debts
    .map((d) => ({ ...d, monthlyInterest: (Number(d.balance) * Number(d.interest_rate)) / 100 / 12 }))
    .filter((d) => Number(d.balance) > 0 && d.monthlyInterest > 0 && Number(d.minimum_payment) <= d.monthlyInterest);
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
  const rates = getRates(data);

  for (const d of nonAmortisingDebts(data)) {
    out.push({
      id: `never-paid-${d.id}`,
      severity: "critical",
      title: `${d.name} never gets paid off`,
      detail: `The minimum payment is at or below the monthly interest (${formatMoney(d.monthlyInterest, d.currency)}), so the balance never falls.`,
      action: `Pay at least ${formatMoney(d.monthlyInterest * 1.5, d.currency)} a month, or refinance it first.`,
    });
  }

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
      title: `Cash you can reach quickly covers ${s.runwayMonths.toFixed(1)} months`,
      detail: `With ${s.dependents} dependent(s), a 6-month buffer is the safe level.`,
      action: `Build a cash reserve of about ${money((s.monthlyExpenses + s.familyCost + s.minimumDebtPayments) * 6)}.`,
    });
  }

  const classes = new Map<string, number>();
  for (const i of data.investments) {
    const v = convert(Number(i.current_value), i.currency, cur, rates);
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
        .filter((i) => i.currency !== "NGN")
        .reduce((a, b) => a + convert(Number(b.current_value), b.currency, cur, rates), 0) /
      s.totalInvested;
    if (usdShare < 0.3) {
      out.push({
        id: "fx",
        severity: "watch",
        title: `Only ${(usdShare * 100).toFixed(0)}% of your investments are in foreign currency`,
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
