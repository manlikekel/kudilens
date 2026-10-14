import { describe, expect, it } from "vitest";
import { performance } from "./performance";
import { COUNTRIES, FUNDS, PLATFORMS, countryFromCurrency } from "./directory";
import { allocation, currencyMix, independence, targetStockShare } from "../finance/wealth";
import type { FinanceData } from "../finance/core";

const month = (y: number, m: number) => Date.UTC(y, m - 1, 1) / 1000;

describe("fund performance", () => {
  // grows exactly 1% a month from Jan 2020 to Oct 2026
  const series: { t: number; close: number }[] = [];
  let p = 100;
  for (let y = 2020; y <= 2026; y++)
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 10) break;
      series.push({ t: month(y, m), close: p });
      p *= 1.01;
    }
  const perf = performance(series)!;
  it("year to date runs from last December's close", () => {
    expect(perf.ytd).toBeCloseTo(Math.pow(1.01, 10) - 1, 6);
  });
  it("1, 3 and 5 year figures match the growth rate, annualised", () => {
    const yearly = Math.pow(1.01, 12) - 1;
    expect(perf.r1y).toBeCloseTo(yearly, 6);
    expect(perf.r3y).toBeCloseTo(yearly, 6);
    expect(perf.r5y).toBeCloseTo(yearly, 6);
  });
  it("returns null when history is too short", () => {
    const short = performance(series.slice(-20))!;
    expect(short.r1y).not.toBeNull();
    expect(short.r3y).toBeNull();
    expect(short.r5y).toBeNull();
  });
  it("price comes from the unadjusted series, returns from the adjusted one", () => {
    const adj = series.map((x) => ({ ...x, close: x.close * 2 }));
    const out = performance(series, adj)!;
    expect(out.price).toBeCloseTo(series.at(-1)!.close, 6);
    expect(out.r1y).toBeCloseTo(perf.r1y!, 6);
  });
});

describe("directory", () => {
  it("every country has a regulator register and platforms", () => {
    for (const c of COUNTRIES) {
      expect(c.regulators.length).toBeGreaterThan(0);
      expect(PLATFORMS[c.code].length).toBeGreaterThan(0);
    }
  });
  it("tracks funds for every country except Nigeria (no free feed)", () => {
    expect(Object.keys(FUNDS).sort()).toEqual(["CA", "GB", "US"]);
  });
  it("guesses a country from the base currency", () => {
    expect(countryFromCurrency("GBP")).toBe("GB");
    expect(countryFromCurrency("NGN")).toBe("NG");
    expect(countryFromCurrency(undefined)).toBe("NG");
  });
});

const data: FinanceData = {
  profile: {
    id: "u",
    full_name: null,
    age: 30,
    retirement_age: 60,
    base_currency: "NGN",
    inflation_rate: 20,
    risk_tolerance: "balanced",
    goals: null,
  },
  debts: [],
  investments: [
    {
      id: "s",
      name: "Stocks",
      asset_class: "stocks",
      current_value: 6_000_000,
      currency: "NGN",
      monthly_contribution: 100_000,
      expected_return: 32,
      notes: null,
    },
    {
      id: "d",
      name: "Dollar fund",
      asset_class: "bonds",
      current_value: 2_000,
      currency: "USD",
      monthly_contribution: 0,
      expected_return: 32,
      notes: null,
    },
  ],
  flows: [
    {
      id: "f",
      label: "Living",
      flow_type: "expense",
      category: "x",
      monthly_amount: 500_000,
      currency: "NGN",
      growth_rate: 0,
    },
  ],
  family: [],
  accounts: [
    {
      id: "a",
      name: "Bank",
      kind: "bank",
      balance: 1_000_000,
      currency: "NGN",
      is_emergency_fund: true,
    },
  ],
  fxRates: [{ currency: "NGN", per_usd: 1500, as_of: "2026-10-01T00:00:00Z" }],
};

describe("wealth tools", () => {
  it("independence target is 25 × yearly spending", () => {
    const fi = independence(data);
    expect(fi.target).toBe(500_000 * 12 * 25);
    expect(fi.invested).toBe(9_000_000);
    // 32% expected / 20% inflation = 10% real
    expect(fi.realReturn).toBeCloseTo(0.1, 6);
    // check the reported year is the first one over the line
    let v = 9_000_000;
    for (let y = 1; y < fi.yearsToGoal!; y++) v = v * 1.1 + 1_200_000;
    expect(v).toBeLessThan(fi.target);
    expect(v * 1.1 + 1_200_000).toBeGreaterThanOrEqual(fi.target);
    expect(fi.ageAtGoal).toBe(30 + fi.yearsToGoal!);
  });
  it("allocation shares add up to 100% and targets follow risk", () => {
    const { rows, total } = allocation(data);
    expect(total).toBe(10_000_000);
    expect(rows.reduce((t, r) => t + r.share, 0)).toBeCloseTo(1, 6);
    expect(rows.find((r) => r.bucket === "Stocks")!.share).toBeCloseTo(0.6, 6);
    expect(targetStockShare("growth", 30)).toBe(0.8);
    expect(targetStockShare("growth", 60)).toBeCloseTo(0.6, 6);
    expect(targetStockShare("conservative", 90)).toBe(0.2);
  });
  it("currency mix shows the foreign share", () => {
    const mix = currencyMix(data);
    expect(mix.foreignShare).toBeCloseTo(3_000_000 / 10_000_000, 6);
    expect(mix.rows[0]!.currency).toBe("NGN");
  });
});
