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
