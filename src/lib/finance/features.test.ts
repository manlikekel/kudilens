import { afterEach, describe, expect, it } from "vitest";
import { formatMoney } from "./fx";
import { setAmountsHidden } from "./mask";

describe("privacy mode", () => {
  afterEach(() => setAmountsHidden(false));
  it("hides amounts but keeps the currency symbol", () => {
    setAmountsHidden(true);
    expect(formatMoney(1_234_567, "NGN")).toBe("₦•••");
    expect(formatMoney(99, "USD", { compact: false })).toBe("$•••");
  });
  it("shows amounts when off", () => {
    expect(formatMoney(1500, "NGN", { compact: false })).toContain("1,500");
  });
});

import { annualised, correlation } from "./market";
import { getAssumptions } from "./assumptions";
import type { FinanceData } from "./core";

describe("live market assumptions", () => {
  const base: FinanceData = {
    profile: {
      id: "u",
      full_name: null,
      age: 30,
      retirement_age: 60,
      base_currency: "NGN",
      inflation_rate: 20,
      risk_tolerance: "balanced",
      goals: null,
      fx_depreciation: 15,
      cash_yield_ratio: 0.5,
    },
    debts: [],
    investments: [],
    flows: [],
    family: [],
  };
  const live = (value: number) => ({ value, label: "", source: "", sourceUrl: "", asOf: "" });
  it("live values replace typed ones, missing ones fall back", () => {
    const a = getAssumptions({
      ...base,
      market: { fetchedAt: "", inflation: live(15.39), fxDepreciation: live(17.47) },
    });
    expect(a.inflation).toBeCloseTo(0.1539, 6);
    expect(a.fxDepreciation).toBeCloseTo(0.1747, 6);
    expect(a.cashYieldRatio).toBe(0.5); // not in market → profile value
  });
  it("without live data the profile is used", () => {
    expect(getAssumptions(base).inflation).toBeCloseTo(0.2, 6);
  });
  it("annualises and correlates", () => {
    expect(annualised(100, 121, 2)).toBeCloseTo(0.1, 6);
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 6);
    expect(correlation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 6);
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

import { debtFreePlan } from "./debtfree";

describe("debt-free countdown", () => {
  const today = new Date(2026, 9, 14);
  const withDebts = (debts: FinanceData["debts"]): FinanceData => ({
    profile: null,
    debts,
    investments: [],
    flows: [],
    family: [],
    fxRates: [{ currency: "NGN", per_usd: 1500, as_of: "2026-10-01T00:00:00Z" }],
  });
  const debt = (id: string, balance: number, rate: number, minimum: number) => ({
    id,
    name: id,
    kind: "loan",
    balance,
    currency: "NGN",
    interest_rate: rate,
    minimum_payment: minimum,
    notes: null,
  });
  it("rolls each cleared payment onto the next debt", () => {
    const plan = debtFreePlan(
      withDebts([debt("a", 300_000, 0, 100_000), debt("b", 600_000, 0, 100_000)]),
      today,
    );
    // a: 3 months at 100k; then b gets 200k/month: 600k − 3×100k = 300k left → 2 more months
    expect(plan.milestones.map((m) => [m.id, m.months])).toEqual([
      ["a", 3],
      ["b", 5],
    ]);
    expect(plan.months).toBe(5);
    expect(plan.debtFreeDate).toEqual(new Date(2027, 2, 1));
    expect(plan.totalInterest).toBe(0);
  });
  it("says never when payments don't cover interest", () => {
    expect(debtFreePlan(withDebts([debt("c", 1_000_000, 36, 10_000)]), today).months).toBeNull();
  });
  it("no debts means already debt-free", () => {
    expect(debtFreePlan(withDebts([]), today).months).toBe(0);
  });
});

import { simulatePath } from "./engine";

describe("real spending in the projection", () => {
  const data: FinanceData = {
    profile: {
      id: "u",
      full_name: null,
      age: 30,
      retirement_age: 60,
      base_currency: "NGN",
      inflation_rate: 0,
      risk_tolerance: "balanced",
      goals: null,
      salary_growth: 0,
      cash_yield_ratio: 0,
    },
    debts: [],
    investments: [],
    flows: [
      {
        id: "i",
        label: "Salary",
        flow_type: "income",
        category: "Salary",
        monthly_amount: 1_000_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "e",
        label: "Living",
        flow_type: "expense",
        category: "Living",
        monthly_amount: 400_000,
        currency: "NGN",
        growth_rate: 0,
      },
    ],
    family: [],
    actualSpend: { avgMonthly: 700_000, months: 3 },
  };
  it("uses typed costs by default and real spending when asked", () => {
    expect(simulatePath(data, 1, null)[1]!.cash).toBe(600_000 * 12);
    expect(simulatePath(data, 1, null, { actualSpending: true })[1]!.cash).toBe(300_000 * 12);
  });
  it("ignores the switch when there are no statements", () => {
    const none = { ...data, actualSpend: { avgMonthly: 0, months: 0 } };
    expect(simulatePath(none, 1, null, { actualSpending: true })[1]!.cash).toBe(600_000 * 12);
  });
});

import { checkInCalendar, checkInSummary, monthKey, sameSnapshot, type Snapshot } from "./history";

describe("net worth history and check-in", () => {
  const snap = (month: string, nw: number, debt: number): Snapshot => ({
    month,
    currency: "NGN",
    net_worth: nw,
    investments: 0,
    cash: 0,
    assets: 0,
    debt,
  });
  it("keys snapshots by month", () => {
    expect(monthKey(new Date(2026, 9, 14))).toBe("2026-10-01");
  });
  it("compares with the latest earlier month", () => {
    const now = snap("2026-10-01", 65_000_000, 37_000_000);
    const s = checkInSummary(
      [snap("2026-08-01", 50e6, 45e6), snap("2026-09-01", 61.5e6, 40.2e6), now],
      now,
    )!;
    expect(s.since).toBe("2026-09-01");
    expect(s.netWorth).toBe(3_500_000);
    expect(s.debt).toBe(-3_200_000);
    expect(checkInSummary([now], now)).toBeNull();
  });
  it("only rewrites a snapshot when something changed", () => {
    expect(sameSnapshot(snap("2026-10-01", 1, 2), snap("2026-10-01", 1, 2))).toBe(true);
    expect(sameSnapshot(snap("2026-10-01", 1, 2), snap("2026-10-01", 1, 3))).toBe(false);
    expect(sameSnapshot(undefined, snap("2026-10-01", 1, 2))).toBe(false);
  });
  it("makes a monthly calendar reminder", () => {
    const ics = checkInCalendar("https://kudilens.lovable.app", new Date(2026, 9, 14));
    expect(ics).toContain("RRULE:FREQ=MONTHLY;BYMONTHDAY=1");
    expect(ics).toContain("DTSTART:20261101T090000");
  });
});

import { monthSpend, safeToSpend, sinkingFunds } from "./budget";

describe("budgets, sinking funds and safe-to-spend", () => {
  const today = new Date(2026, 9, 14); // 14 Oct 2026
  const data: FinanceData = {
    profile: {
      id: "u",
      full_name: null,
      age: 30,
      retirement_age: 60,
      base_currency: "NGN",
      inflation_rate: 15,
      risk_tolerance: "balanced",
      goals: null,
    },
    debts: [
      {
        id: "d",
        name: "Loan",
        kind: "loan",
        balance: 1_000_000,
        currency: "NGN",
        interest_rate: 0,
        minimum_payment: 200_000,
        notes: null,
      },
    ],
    investments: [
      {
        id: "i",
        name: "Fund",
        asset_class: "stocks",
        current_value: 0,
        currency: "NGN",
        monthly_contribution: 100_000,
        expected_return: 10,
        notes: null,
      },
    ],
    flows: [
      {
        id: "s",
        label: "Salary",
        flow_type: "income",
        category: "Salary",
        monthly_amount: 1_000_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "l",
        label: "Living",
        flow_type: "expense",
        category: "Living",
        monthly_amount: 400_000,
        currency: "NGN",
        growth_rate: 0,
      },
    ],
    family: [],
    lumps: [
      {
        id: "f",
        label: "School fees",
        amount: 600_000,
        currency: "NGN",
        months: [1, 5, 9],
        saved: 200_000,
      },
    ],
    fxRates: [{ currency: "NGN", per_usd: 1500, as_of: "2026-10-01T00:00:00Z" }],
  };
  const tx = (date: string, naira: number, category: string, merchant = "SHOP") => ({
    txn_date: date,
    amount_minor: Math.round(naira * 100),
    category,
    currency: "NGN",
    merchant,
  });

  it("sinking fund: next due date, monthly set-aside and catch-up amount", () => {
    const [f] = sinkingFunds(data, today);
    expect(f!.nextDue).toEqual(new Date(2027, 0, 1)); // after September comes January
    expect(f!.monthsUntil).toBe(3);
    expect(f!.monthly).toBe(150_000); // 3 × 600k a year ÷ 12
    expect(f!.neededPerMonth).toBe(Math.round(400_000 / 3));
  });
  it("counts only this month's real spending", () => {
    const m = monthSpend(
      data,
      [
        tx("2026-10-02", -50_000, "Groceries"),
        tx("2026-10-03", -70_000, "Transfers"),
        tx("2026-09-30", -9_000, "Groceries"),
      ],
      today,
    );
    expect(m.total).toBe(50_000);
    expect(m.byCategory).toEqual({ Groceries: 50_000 });
  });
  it("plan mode: income minus commitments and planned costs", () => {
    const s = safeToSpend(data, [], today);
    expect(s.mode).toBe("plan");
    // 1m − 200k debt − 100k investing − 150k sinking − 400k living
    expect(s.safe).toBe(150_000);
    expect(s.daysLeft).toBe(18);
    expect(s.perDay).toBe(Math.round(150_000 / 18));
  });
  it("live mode: subtracts what's been spent and bills still to come", () => {
    const txns = [
      tx("2026-08-20", -15_000, "Subscriptions", "DSTV PAYMENT"),
      tx("2026-09-19", -15_000, "Subscriptions", "DSTV PAYMENT"),
      tx("2026-10-05", -120_000, "Groceries"),
    ];
    const s = safeToSpend(data, txns, today);
    expect(s.mode).toBe("live");
    expect(s.spending).toBe(120_000);
    expect(s.bills.map((b) => b.merchant)).toEqual(["DSTV PAYMENT"]);
    expect(s.safe).toBe(1_000_000 - 200_000 - 100_000 - 150_000 - 120_000 - 15_000);
  });
});
