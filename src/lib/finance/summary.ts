import { summarize, type FinanceData } from "./core";
import { getAssumptions, toNGN } from "./assumptions";
import { monteCarlo } from "./montecarlo";
import { analyzeGoals } from "./goals";
import { emergencyFund } from "./emergency";
import { simulatePayoff } from "./debt";
import { nonAmortisingDebts } from "./insights";

/** 0-100 health score from savings rate, debt load, emergency buffer and goal odds. */
export function healthScore(data: FinanceData): { score: number; parts: Record<string, number> } {
  const s = summarize(data);
  const ef = emergencyFund(data);
  const goals = analyzeGoals(data);
  const savings = Math.min(25, Math.max(0, s.savingsRate * 100));
  const dti = s.monthlyIncome > 0 ? s.minimumDebtPayments / s.monthlyIncome : 1;
  const debt = Math.max(0, 25 - dti * 60);
  const buffer = ef.target > 0 ? Math.min(25, (ef.current / ef.target) * 25) : 25;
  const goal = goals.length ? (goals.reduce((t, g) => t + g.probability, 0) / goals.length) * 25 : 15;
  const parts = { savings, debt, buffer, goals: goal };
  return { score: Math.round(savings + debt + buffer + goal), parts };
}

/**
 * Compact, name-free JSON summary sent to the AI. Household members appear only as
 * relationship + age; no personal names are included.
 */
export function aiSummary(data: FinanceData) {
  const a = getAssumptions(data);
  const s = summarize(data);
  const mc = monteCarlo(data, { years: 20, sims: 300 });
  const pick = (y: number) => mc.points[Math.min(y, mc.points.length - 1)]!;
  const payoff = simulatePayoff(
    data.debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: toNGN(d.balance, d.currency, a),
      rate: Number(d.interest_rate),
      minimum: toNGN(d.minimum_payment, d.currency, a),
    })),
    "avalanche",
  );
  const r = (x: number) => Math.round(x);
  return {
    profile: {
      age: data.profile?.age,
      retirement_age: data.profile?.retirement_age,
      base_currency: s.currency,
      risk_tolerance: data.profile?.risk_tolerance,
      stated_goals: data.profile?.goals,
    },
    household: data.family.map((m) => ({ relationship: m.relationship, age: m.age, dependent: m.dependent })),
    cash_flow: {
      monthly_income: r(s.monthlyIncome),
      monthly_expenses: r(s.monthlyExpenses),
      family_cost: r(s.familyCost),
      surplus: r(s.monthlySurplus),
      savings_rate_pct: r(s.savingsRate * 100),
      lines: data.flows.map((f) => ({ type: f.flow_type, category: f.category, label: f.label, amount: f.monthly_amount, currency: f.currency })),
      lump_costs: (data.lumps ?? []).map((l) => ({ label: l.label, amount: l.amount, currency: l.currency, months: l.months })),
    },
    accounts: (data.accounts ?? []).map((x) => ({ name: x.name, kind: x.kind, balance: x.balance, currency: x.currency, emergency_fund: x.is_emergency_fund })),
    assets: (data.assets ?? []).map((x) => ({ name: x.name, kind: x.kind, value: x.current_value, currency: x.currency, appreciation_pct: x.appreciation, liquid: x.liquid })),
    balance_sheet: { accounts: r(s.totalAccounts), investments: r(s.totalInvested), assets: r(s.totalAssets), debts: r(s.totalDebt), net_worth: r(s.netWorth), liquid: r(s.liquidAssets), runway_months: Number(s.runwayMonths.toFixed(1)) },
    debts_never_paid_off: nonAmortisingDebts(data).map((d) => d.name),
    debts: data.debts.map((d) => ({ name: d.name, kind: d.kind, balance: d.balance, currency: d.currency, rate_pct: d.interest_rate, min_payment: d.minimum_payment })),
    holdings: data.investments.map((i) => ({ name: i.name, class: i.asset_class, value: i.current_value, currency: i.currency, monthly: i.monthly_contribution, expected_return_pct: i.expected_return, notes: i.notes })),
    goals: analyzeGoals(data).map((g) => ({ name: g.goal.name, target: g.goal.target_amount, currency: g.goal.currency, year: g.goal.target_year, month: g.goal.target_month ?? 12, saved_in: g.goal.saved_in, future_cost_ngn: g.targetNGN, probability_pct: r(g.probability * 100), monthly_needed_75pct_ngn: r(g.required.p75) })),
    assumptions: {
      rates_per_usd: a.rates.perUSD,
      rates_as_of: a.rates.asOf,
      user_overridden_rates: a.rates.overridden,
      inflation_fx_correlation: a.infFxCorrelation,
      cash_yield_share_of_inflation: a.cashYieldRatio,
      foreign_inflation_pct: a.foreignInflation * 100,
      inflation_pct: a.inflation * 100,
      fx_depreciation_pct: a.fxDepreciation * 100,
      education_inflation_pct: a.educationInflation * 100,
      salary_growth_pct: a.salaryGrowth * 100,
    },
    health_score: healthScore(data),
    forecast_ngn: {
      net_worth_now: r(s.netWorth),
      y5: pick(5).nominal.map(r),
      y10: pick(10).nominal.map(r),
      y20: pick(20).nominal.map(r),
      y10_real_today_money: pick(10).real.map(r),
      note: "[p10, p50, p90]",
    },
    debt_free_in_months_avalanche: payoff.months,
    emergency_fund: emergencyFund(data),
  };
}
