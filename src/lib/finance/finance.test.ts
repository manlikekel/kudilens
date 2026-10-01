import { describe, expect, it } from "vitest";
import type { FinanceData } from "./core";
import { simulatePayoff, debtsAboveReturn } from "./debt";
import { goalProbability, requiredMonthly } from "./goals";
import { monteCarlo } from "./montecarlo";
import { forecastCash } from "./cashflow";
import { stageForAge, educationForecast, lifeEvents } from "./family";
import { devaluationShock, realReturns } from "./stress";
import { emergencyFund, protectionGaps } from "./emergency";
import { aiSummary } from "./summary";

const data: FinanceData = {
  profile: {
    id: "u", full_name: "Test", age: 35, retirement_age: 60, base_currency: "NGN",
    usd_ngn_rate: 1500, inflation_rate: 20, risk_tolerance: "balanced", goals: null,
    fx_depreciation: 15, education_inflation: 20, salary_growth: 10, income_stability: "stable",
  },
  debts: [
    { id: "a", name: "Card", kind: "credit card", balance: 500_000, currency: "NGN", interest_rate: 36, minimum_payment: 50_000, notes: null },
    { id: "b", name: "Car", kind: "car loan", balance: 3_000_000, currency: "NGN", interest_rate: 18, minimum_payment: 150_000, notes: null },
  ],
  investments: [
    { id: "i1", name: "Savings", asset_class: "cash", current_value: 1_000_000, currency: "NGN", monthly_contribution: 0, expected_return: 8, notes: null },
    { id: "i2", name: "Eurobond", asset_class: "bonds", current_value: 2_000, currency: "USD", monthly_contribution: 0, expected_return: 7, notes: null },
  ],
  flows: [
    { id: "f1", label: "Salary", flow_type: "income", category: "Salary", monthly_amount: 1_200_000, currency: "NGN", growth_rate: 0 },
    { id: "f2", label: "Living", flow_type: "expense", category: "Living", monthly_amount: 600_000, currency: "NGN", growth_rate: 0 },
  ],
  family: [{ id: "k", name: "Ada", relationship: "child", age: 4, dependent: true, monthly_cost: 50_000, currency: "NGN" }],
  goals: [{ id: "g", name: "Canada relocation", target_amount: 20_000, currency: "USD", target_year: new Date().getFullYear() + 3, current_saved: 0, monthly_contribution: 0, priority: 1 }],
  lumps: [{ id: "l", label: "School fees", amount: 900_000, currency: "NGN", months: [1, 5, 9] }],
};

describe("debt optimiser", () => {
  const debts = data.debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, rate: d.interest_rate, minimum: d.minimum_payment }));
  it("avalanche never pays more interest than snowball", () => {
    const av = simulatePayoff(debts, "avalanche", 100_000);
    const sn = simulatePayoff(debts, "snowball", 100_000);
    expect(av.finished).toBe(true);
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest + 1);
  });
  it("extra payments shorten payoff", () => {
    expect(simulatePayoff(debts, "avalanche", 200_000).months).toBeLessThan(simulatePayoff(debts, "avalanche", 0).months);
  });
  it("flags debts above portfolio return", () => {
    expect(debtsAboveReturn(debts, 20).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("goals", () => {
  it("probability rises with contributions", () => {
    expect(goalProbability(0, 500_000, 10_000_000, 2)).toBeGreaterThan(goalProbability(0, 100_000, 10_000_000, 2));
  });
  it("required monthly for 90% exceeds 50%", () => {
    expect(requiredMonthly(0, 10_000_000, 3, 0.9)).toBeGreaterThan(requiredMonthly(0, 10_000_000, 3, 0.5));
  });
});

describe("monte carlo", () => {
  it("returns ordered percentiles and is deterministic", () => {
    const a = monteCarlo(data, { years: 5, sims: 200 });
    const b = monteCarlo(data, { years: 5, sims: 200 });
    const p = a.points[5].nominal;
    expect(p[0]).toBeLessThanOrEqual(p[1]);
    expect(p[1]).toBeLessThanOrEqual(p[2]);
    expect(a.points[5].nominal).toEqual(b.points[5].nominal);
  });
});

describe("cash flow", () => {
  it("adds sinking fund for lump sums", () => {
    const f = forecastCash(data, new Date(2026, 0, 15));
    expect(f.months).toHaveLength(12);
    expect(Math.round(f.sinkingFund)).toBe(225_000);
  });
});

describe("family", () => {
  it("maps ages to stages", () => {
    expect(stageForAge(4)).toBe("nursery");
    expect(stageForAge(19)).toBe("university");
  });
  it("forecasts costs and name-free events", () => {
    expect(educationForecast(data, 5)[0].local).toBeGreaterThan(0);
    expect(lifeEvents(data).some((e) => e.label.includes("Ada"))).toBe(false);
  });
});

describe("stress & protection", () => {
  it("devaluation raises Naira value of dollar assets", () => {
    const r = devaluationShock({ ...data, debts: [] }, 0.3);
    expect(r.after.ngn).toBeGreaterThan(r.before.ngn);
    expect(r.after.usd).toBeLessThan(r.before.usd);
  });
  it("real return below nominal", () => {
    expect(realReturns(data)[0].real).toBeLessThan(8);
  });
  it("emergency months include dependants", () => {
    expect(emergencyFund(data).months).toBe(4);
    expect(protectionGaps(data)[0].gap).toBeGreaterThan(0);
  });
});

describe("AI summary", () => {
  it("never contains household names", () => {
    expect(JSON.stringify(aiSummary(data))).not.toContain("Ada");
  });
});
