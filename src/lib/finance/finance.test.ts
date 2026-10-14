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
    id: "u",
    full_name: "Test",
    age: 35,
    retirement_age: 60,
    base_currency: "NGN",
    inflation_rate: 20,
    risk_tolerance: "balanced",
    goals: null,
    fx_depreciation: 15,
    education_inflation: 20,
    salary_growth: 10,
    income_stability: "stable",
  },
  debts: [
    {
      id: "a",
      name: "Card",
      kind: "credit card",
      balance: 500_000,
      currency: "NGN",
      interest_rate: 36,
      minimum_payment: 50_000,
      notes: null,
    },
    {
      id: "b",
      name: "Car",
      kind: "car loan",
      balance: 3_000_000,
      currency: "NGN",
      interest_rate: 18,
      minimum_payment: 150_000,
      notes: null,
    },
  ],
  investments: [
    {
      id: "i1",
      name: "Savings",
      asset_class: "cash",
      current_value: 1_000_000,
      currency: "NGN",
      monthly_contribution: 0,
      expected_return: 8,
      notes: null,
    },
    {
      id: "i2",
      name: "Eurobond",
      asset_class: "bonds",
      current_value: 2_000,
      currency: "USD",
      monthly_contribution: 0,
      expected_return: 7,
      notes: null,
    },
  ],
  flows: [
    {
      id: "f1",
      label: "Salary",
      flow_type: "income",
      category: "Salary",
      monthly_amount: 1_200_000,
      currency: "NGN",
      growth_rate: 0,
    },
    {
      id: "f2",
      label: "Living",
      flow_type: "expense",
      category: "Living",
      monthly_amount: 600_000,
      currency: "NGN",
      growth_rate: 0,
    },
  ],
  family: [
    {
      id: "k",
      name: "Ada",
      relationship: "child",
      age: 4,
      dependent: true,
      monthly_cost: 50_000,
      currency: "NGN",
    },
  ],
  goals: [
    {
      id: "g",
      name: "Canada relocation",
      target_amount: 20_000,
      currency: "USD",
      target_year: new Date().getFullYear() + 3,
      current_saved: 0,
      monthly_contribution: 0,
      priority: 1,
    },
  ],
  lumps: [{ id: "l", label: "School fees", amount: 900_000, currency: "NGN", months: [1, 5, 9] }],
  fxRates: [
    { currency: "NGN", per_usd: 1500, as_of: "2026-10-01T00:00:00Z" },
    { currency: "GBP", per_usd: 0.8, as_of: "2026-10-01T00:00:00Z" },
    { currency: "EUR", per_usd: 0.9, as_of: "2026-10-01T00:00:00Z" },
    { currency: "CAD", per_usd: 1.25, as_of: "2026-10-01T00:00:00Z" },
  ],
};

describe("debt optimiser", () => {
  const debts = data.debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    rate: d.interest_rate,
    minimum: d.minimum_payment,
  }));
  it("avalanche never pays more interest than snowball", () => {
    const av = simulatePayoff(debts, "avalanche", 100_000);
    const sn = simulatePayoff(debts, "snowball", 100_000);
    expect(av.finished).toBe(true);
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest + 1);
  });
  it("extra payments shorten payoff", () => {
    expect(simulatePayoff(debts, "avalanche", 200_000).months).toBeLessThan(
      simulatePayoff(debts, "avalanche", 0).months,
    );
  });
  it("flags debts above portfolio return", () => {
    expect(debtsAboveReturn(debts, 20).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("goals", () => {
  it("probability rises with contributions", () => {
    expect(goalProbability(0, 500_000, 10_000_000, 24)).toBeGreaterThan(
      goalProbability(0, 100_000, 10_000_000, 24),
    );
  });
  it("required monthly for 90% exceeds 50%", () => {
    expect(requiredMonthly(0, 10_000_000, 36, 0.9, { mu: 0.18, sigma: 0.12 })).toBeGreaterThan(
      requiredMonthly(0, 10_000_000, 36, 0.5, { mu: 0.18, sigma: 0.12 }),
    );
  });
});

describe("monte carlo", () => {
  it("returns ordered percentiles and is deterministic", () => {
    const a = monteCarlo(data, { years: 5, sims: 200 });
    const b = monteCarlo(data, { years: 5, sims: 200 });
    const p = a.points[5]!.nominal;
    expect(p[0]).toBeLessThanOrEqual(p[1]);
    expect(p[1]).toBeLessThanOrEqual(p[2]);
    expect(a.points[5]!.nominal).toEqual(b.points[5]!.nominal);
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
    expect(educationForecast(data, 5)[0]!.local).toBeGreaterThan(0);
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
    expect(realReturns(data)[0]!.real).toBeLessThan(8);
  });
  it("emergency months include dependants", () => {
    expect(emergencyFund(data).months).toBe(4);
    expect(protectionGaps(data)[0]!.gap).toBeGreaterThan(0);
  });
});

describe("AI summary", () => {
  it("never contains household names", () => {
    expect(JSON.stringify(aiSummary(data))).not.toContain("Ada");
  });
});

/* ---------------- corrections pass ---------------- */
import { buildRates, convert, formatMoney, missingCurrencies } from "./fx";
import { addMoney, fromMinor, money, sumExact, toMinor } from "./money";
import { getRates, summarize } from "./core";
import { investmentGrowth, project, simulatePath } from "./engine";
import { nonAmortisingDebts } from "./insights";
import { analyzeGoals, goalTargetNGN, monthsUntil } from "./goals";
import { getAssumptions } from "./assumptions";

describe("money helpers", () => {
  it("round-trips minor units and adds exactly", () => {
    expect(toMinor(0.1) + toMinor(0.2)).toBe(30);
    expect(fromMinor(12345)).toBe(123.45);
    expect(sumExact([0.1, 0.2])).toBe(0.3);
    expect(addMoney(money(1.5, "NGN"), money(2.25, "NGN")).minor).toBe(375);
    expect(() => addMoney(money(1, "NGN"), money(1, "USD"))).toThrow();
  });
});

describe("multi-currency conversion", () => {
  const rates = getRates(data);
  it("converts through USD for every pair", () => {
    expect(convert(100, "USD", "NGN", rates)).toBe(150_000);
    expect(convert(80, "GBP", "USD", rates)).toBeCloseTo(100);
    expect(convert(125, "CAD", "NGN", rates)).toBeCloseTo(150_000);
    expect(convert(90, "EUR", "GBP", rates)).toBeCloseTo(80);
  });
  it("never guesses a missing rate", () => {
    const empty = buildRates([], {});
    expect(convert(100, "NGN", "USD", empty)).toBe(0);
    expect(missingCurrencies(["NGN", "GBP"], "USD", empty)).toEqual(["NGN", "GBP"]);
  });
  it("user override wins over the official rate", () => {
    const r = buildRates(data.fxRates, { NGN: 1700 });
    expect(convert(1, "USD", "NGN", r)).toBe(1700);
    expect(r.overridden).toEqual(["NGN"]);
  });
  it("formats with the right symbol", () => {
    expect(formatMoney(1500, "GBP", { compact: false })).toContain("£");
    expect(formatMoney(1500, "NGN", { compact: false })).toContain("₦");
  });
});

describe("balance sheet", () => {
  const withSheet = {
    ...data,
    accounts: [
      {
        id: "acc",
        name: "Bank",
        kind: "bank",
        balance: 2_000_000,
        currency: "NGN",
        is_emergency_fund: true,
      },
    ],
    assets: [
      {
        id: "as",
        name: "Land",
        kind: "land",
        current_value: 10_000_000,
        currency: "NGN",
        appreciation: 10,
        liquid: false,
      },
    ],
  };
  it("net worth includes accounts and assets", () => {
    const s0 = summarize(data);
    const s1 = summarize(withSheet);
    expect(s1.netWorth - s0.netWorth).toBe(12_000_000);
  });
  it("runway uses only liquid money, not land", () => {
    const s = summarize(withSheet);
    // bank 2m + cash pot 1m; land and the bond are excluded
    expect(s.liquidAssets).toBe(3_000_000);
    expect(s.runwayMonths).toBeCloseTo(3_000_000 / (600_000 + 50_000 + 200_000));
  });
  it("monte carlo starts from real account balances", () => {
    expect(simulatePath(withSheet, 1, null)[0]!.cash).toBe(2_000_000);
  });
});

describe("engine", () => {
  it("negative surplus draws down cash, then investments", () => {
    const broke = {
      ...data,
      debts: [],
      flows: [
        {
          id: "f",
          label: "Living",
          flow_type: "expense",
          category: "x",
          monthly_amount: 300_000,
          currency: "NGN",
          growth_rate: 0,
        },
      ],
      accounts: [
        {
          id: "a",
          name: "Bank",
          kind: "bank",
          balance: 1_000_000,
          currency: "NGN",
          is_emergency_fund: false,
        },
      ],
    };
    const p = simulatePath(broke, 2, null, { volScale: 0 });
    expect(p[1]!.cash).toBeLessThanOrEqual(0.01);
    expect(p[1]!.investments).toBeLessThan(p[0]!.investments);
  });
  it("project() compounds each pot at exactly its expected return, however volatile", () => {
    const stocksOnly = {
      ...data,
      debts: [],
      flows: [],
      family: [],
      investments: [
        {
          id: "s",
          name: "Stocks",
          asset_class: "stocks",
          current_value: 10_000_000,
          currency: "NGN",
          monthly_contribution: 0,
          expected_return: 20,
          notes: null,
        },
      ],
    };
    const crypto = {
      ...stocksOnly,
      investments: [{ ...stocksOnly.investments[0]!, asset_class: "crypto" }],
    };
    expect(project(stocksOnly, 2, 0)[2]!.investments).toBe(14_400_000);
    expect(project(crypto, 2, 0)[2]!.investments).toBe(14_400_000);
  });
  it("project() investments are pots only, not cash or property", () => {
    const withSheet = {
      ...data,
      accounts: [
        {
          id: "acc",
          name: "Bank",
          kind: "bank",
          balance: 2_000_000,
          currency: "NGN",
          is_emergency_fund: false,
        },
      ],
      assets: [
        {
          id: "as",
          name: "Land",
          kind: "land",
          current_value: 10_000_000,
          currency: "NGN",
          appreciation: 10,
          liquid: false,
        },
      ],
    };
    const p0 = project(withSheet, 1, 0)[0]!;
    expect(p0.investments).toBe(1_000_000 + 2_000 * 1500);
    expect(p0.cash).toBe(2_000_000);
    expect(p0.assets).toBe(10_000_000);
  });
  it("year-on-year change splits into parts that add up to the total", () => {
    const p = project(data, 3, 0);
    for (const pt of p.slice(1)) {
      const c = pt.change!;
      const sum =
        c.leftover +
        c.investmentReturns +
        c.assetGrowth +
        c.cashInterest +
        c.debtInterest +
        c.fxRevaluation;
      expect(sum).toBeCloseTo(c.total, 0);
    }
    const prev = project(data, 1, 0);
    expect(prev[1]!.change!.total).toBe(prev[1]!.netWorth - prev[0]!.netWorth);
    // salary 1.2m − living 0.6m − family 50k, for 12 months
    expect(p[1]!.change!.leftover).toBe((1_200_000 - 600_000 - 50_000) * 12);
    // card 500k × 36% + car 3m × 18%
    expect(p[1]!.change!.debtInterest).toBe(-(500_000 * 0.36 + 3_000_000 * 0.18));
    // USD bond gains 15% in Naira terms
    expect(p[1]!.change!.fxRevaluation).toBeCloseTo(2_000 * 1500 * 0.15, -2);
  });
  it("investmentGrowth follows value × (1 + rate) + yearly contribution", () => {
    const pots = {
      ...data,
      investments: [
        {
          id: "p",
          name: "Fund",
          asset_class: "stocks",
          current_value: 1_000_000,
          currency: "NGN",
          monthly_contribution: 100_000,
          expected_return: 10,
          notes: null,
        },
      ],
    };
    const flat = investmentGrowth(
      { ...pots, profile: { ...data.profile!, grow_contributions: false } },
      2,
    )[0]!;
    expect(flat.values).toEqual([1_000_000, 2_300_000, 3_730_000]);
    expect(flat.contributed).toBe(2_400_000);
    const rising = investmentGrowth(pots, 2)[0]!;
    expect(rising.values[2]).toBe(Math.round(2_300_000 * 1.1 + 1_200_000 * 1.1));
    // matches the engine's pot value when nothing else is going on
    const solo = { ...pots, debts: [], flows: [data.flows[0]!], family: [] };
    expect(project(solo, 2, 0)[2]!.investments).toBe(rising.values[2]);
  });
  it("simple interest grows only on what was paid in", () => {
    const solo = {
      ...data,
      debts: [],
      flows: [],
      family: [],
      investments: [
        {
          id: "s",
          name: "Fund",
          asset_class: "stocks",
          current_value: 10_000_000,
          currency: "NGN",
          monthly_contribution: 0,
          expected_return: 20,
          notes: null,
        },
      ],
    };
    expect(project(solo, 2, 0, { interest: "simple" })[2]!.investments).toBe(14_000_000);
    expect(project(solo, 2, 0, { interest: "compound" })[2]!.investments).toBe(14_400_000);
    const pots = {
      ...solo,
      profile: { ...data.profile!, grow_contributions: false },
      investments: [
        {
          ...solo.investments[0]!,
          current_value: 1_000_000,
          monthly_contribution: 100_000,
          expected_return: 10,
        },
      ],
    };
    // y1: 1m + 10% of 1m + 1.2m = 2.3m; y2: 2.3m + 10% of 2.2m paid in + 1.2m = 3.72m
    expect(investmentGrowth(pots, 2, "simple")[0]!.values).toEqual([
      1_000_000, 2_300_000, 3_720_000,
    ]);
  });
  it("protected investments are never sold; the shortfall shows as debt instead", () => {
    const broke = {
      ...data,
      debts: [],
      flows: [
        {
          id: "f",
          label: "Living",
          flow_type: "expense",
          category: "x",
          monthly_amount: 300_000,
          currency: "NGN",
          growth_rate: 0,
        },
      ],
      accounts: [
        {
          id: "a",
          name: "Bank",
          kind: "bank",
          balance: 1_000_000,
          currency: "NGN",
          is_emergency_fund: false,
        },
      ],
    };
    const sold = project(broke, 1, 0)[1]!;
    const kept = project(broke, 1, 0, { protectInvestments: true })[1]!;
    expect(kept.investments).toBeGreaterThan(sold.investments);
    expect(kept.debt).toBeGreaterThan(0);
    expect(sold.debt).toBe(0);
  });
  it("project() median matches the Monte Carlo p50 within 10% at zero volatility", () => {
    const det = project(data, 10, 0);
    const mc = monteCarlo(data, { years: 10, sims: 50, volScale: 0 });
    const a = det[10]!.netWorth;
    const b = mc.points[10]!.nominal[1];
    expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(0.1);
  });
  it("USD pots pick up Naira depreciation in project()", () => {
    const usdOnly = {
      ...data,
      debts: [],
      flows: [],
      family: [],
      investments: [data.investments[1]!],
    };
    const p = project(
      { ...usdOnly, investments: [{ ...data.investments[1]!, expected_return: 0 }] },
      1,
      0,
    );
    expect(p[1]!.netWorth).toBeCloseTo(2_000 * 1500 * 1.15, -2);
  });
  it("flags a debt whose minimum never covers the interest", () => {
    const bad = {
      ...data,
      debts: [
        { ...data.debts[0]!, balance: 1_000_000, interest_rate: 36, minimum_payment: 20_000 },
      ],
    };
    expect(nonAmortisingDebts(bad).map((d) => d.id)).toEqual(["a"]);
    expect(nonAmortisingDebts(data)).toHaveLength(0);
  });
});

describe("goal corrections", () => {
  const a = getAssumptions(data);
  it("NGN goals grow with inflation", () => {
    const house = {
      id: "h",
      name: "House",
      target_amount: 50_000_000,
      currency: "NGN",
      target_year: 2031,
      target_month: 12,
      current_saved: 0,
      monthly_contribution: 0,
      priority: 1,
    };
    expect(goalTargetNGN(house, 60, a)).toBeCloseTo(50_000_000 * Math.pow(1.2, 5), -3);
    expect(goalTargetNGN({ ...house, goal_inflation: 30 }, 60, a)).toBeCloseTo(
      50_000_000 * Math.pow(1.3, 5),
      -3,
    );
  });
  it("CAD goals inflate abroad and convert at the weakened Naira", () => {
    const cad = {
      id: "c",
      name: "Canada",
      target_amount: 10_000,
      currency: "CAD",
      target_year: 2028,
      current_saved: 0,
      monthly_contribution: 0,
      priority: 1,
    };
    const expected = 10_000 * Math.pow(1.03, 2) * (1500 / 1.25) * Math.pow(1.15, 2);
    expect(goalTargetNGN(cad, 24, a)).toBeCloseTo(expected, -2);
  });
  it("uses target month, so a December goal isn't 0 years away", () => {
    const g = {
      id: "d",
      name: "Dec",
      target_amount: 1,
      currency: "NGN",
      target_year: 2026,
      target_month: 12,
      current_saved: 0,
      monthly_contribution: 0,
      priority: 1,
    };
    expect(monthsUntil(g, new Date(2026, 9, 9))).toBe(2);
  });
  it("results are stable between runs", () => {
    expect(analyzeGoals(data)[0]!.required).toEqual(analyzeGoals(data)[0]!.required);
  });
  it("a linked account supplies the starting balance", () => {
    const linked = {
      ...data,
      accounts: [
        {
          id: "acc",
          name: "Dom",
          kind: "domiciliary",
          balance: 5_000,
          currency: "USD",
          is_emergency_fund: false,
        },
      ],
      goals: [{ ...data.goals![0]!, linked_account_id: "acc", current_saved: 999 }],
    };
    expect(analyzeGoals(linked)[0]!.startNGN).toBe(7_500_000);
  });
});
