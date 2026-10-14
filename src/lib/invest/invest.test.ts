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

import { parseValuation, sectionNames, sharedStrings, sheetRows } from "./secnav";

describe("SEC weekly report parser", () => {
  const strings = sharedStrings(
    "<sst><si><t>WEEKLY VALUATION REPORT OF COLLECTIVE INVESTMENT SCHEMES AS AT WEEK ENDED FRIDAY, OCTOBER 2, 2026</t></si>" +
      "<si><t>EQUITY BASED FUNDS</t></si><si><t>Alpha Equity Fund</t></si><si><t>Alpha AM</t></si>" +
      "<si><t>Sub-Total</t></si><si><t>Beta Money Market Fund</t></si><si><t>Beta AM</t></si>" +
      "<si><t>Gamma Dollar Fund</t></si><si><t>DOLLAR FUNDS</t></si><si><t>EUROBONDS</t></si>" +
      "<si><t>N/A</t></si><si><t>MONEY MARKET FUNDS</t></si></sst>",
  );
  const cell = (ref: string, v: string | number, shared = false) =>
    shared ? `<c r="${ref}" t="s"><v>${v}</v></c>` : `<c r="${ref}"><v>${v}</v></c>`;
  const row = (n: number, cells: string) => `<row r="${n}">${cells}</row>`;
  const sheet =
    "<sheetData>" +
    row(1, cell("A1", 0, true)) +
    row(4, cell("B4", 1, true)) +
    row(
      5,
      cell("A5", 1) +
        cell("B5", 2, true) +
        cell("C5", 3, true) +
        cell("O5", 1000) +
        cell("Q5", 10, true) +
        cell("R5", 12.5) +
        cell("U5", 40) +
        cell("V5", -0.01) +
        cell("W5", 0.47),
    ) +
    row(6, cell("C6", 4, true)) +
    row(
      7,
      cell("A7", 2) +
        cell("B7", 5, true) +
        cell("C7", 6, true) +
        cell("O7", 5000) +
        cell("R7", 1) +
        cell("U7", 900) +
        cell("V7", 0.17) +
        cell("W7", 0.17),
    ) +
    row(8, cell("C8", 4, true)) +
    row(9, cell("B9", 9, true)) +
    row(
      10,
      cell("A10", 3) +
        cell("B10", 7, true) +
        cell("C10", 6, true) +
        cell("O10", 800) +
        cell("Q10", 1.72) +
        cell("R10", 2288) +
        cell("W10", 0.038),
    ) +
    "</sheetData>";
  const comparison = sheetRows(
    "<sheetData>" +
      row(1, cell("A1", "FUNDS")) +
      row(2, cell("A2", 1, true) + cell("B2", 243.8)) +
      row(3, cell("A3", 11, true) + cell("B3", 6563.9)) +
      row(4, cell("A4", 8, true) + cell("B4", 1734.1)) +
      row(5, cell("A5", 1, true) + cell("B5", 243.8)) +
      "</sheetData>",
    strings,
  );
  const report = parseValuation(sheetRows(sheet, strings), sectionNames(comparison));

  it("reads the week and every fund row", () => {
    expect(report.weekEnded).toBe("OCTOBER 2, 2026");
    expect(report.funds.map((f) => f.name)).toEqual([
      "Alpha Equity Fund",
      "Beta Money Market Fund",
      "Gamma Dollar Fund",
    ]);
  });
  it("names groups by sub-total blocks, including ones without a heading row", () => {
    expect(report.funds.map((f) => f.category)).toEqual([
      "Equity Based Funds",
      "Money Market Funds",
      "Dollar Funds · Eurobonds",
    ]);
  });
  it("takes this week's figures and the dollar price for dollar funds", () => {
    const [eq, mm, usd] = report.funds;
    expect(eq).toMatchObject({
      nav: 1000,
      price: 12.5,
      priceCurrency: "NGN",
      unitholders: 40,
      yieldWtd: -0.01,
      yieldYtd: 0.47,
    });
    expect(mm!.yieldYtd).toBe(0.17);
    expect(usd).toMatchObject({ price: 1.72, priceCurrency: "USD", yieldYtd: 0.038 });
  });
});

import { goalPlan } from "./goalplan";

describe("goal plans", () => {
  it("matches the product to how soon the money is needed", () => {
    expect(goalPlan({ currency: "NGN" }, 6, "NG").savedIn).toBe("money market");
    expect(goalPlan({ currency: "NGN" }, 24, "NG").savedIn).toBe("t-bills");
    expect(goalPlan({ currency: "NGN" }, 48, "NG").vehicle).toMatch(/Balanced/);
    expect(goalPlan({ currency: "NGN" }, 120, "NG").savedIn).toBe("stocks");
  });
  it("keeps foreign-currency goals in that currency for Nigerians", () => {
    const p = goalPlan({ currency: "CAD", saved_in: "money market" }, 36, "NG");
    expect(p.savedIn).toBe("usd eurobond");
    expect(p.warning).toMatch(/Naira/);
    expect(p.platforms.length).toBeGreaterThan(0);
  });
  it("warns when a long goal sits in cash or a short one in stocks", () => {
    expect(goalPlan({ currency: "USD", saved_in: "savings account" }, 120, "US").warning).toMatch(
      /inflation/,
    );
    expect(goalPlan({ currency: "GBP", saved_in: "stocks" }, 6, "GB").warning).toMatch(/safer/);
  });
  it("only suggests platforms with confirmed licences", () => {
    for (const months of [6, 24, 48, 120])
      expect(goalPlan({ currency: "NGN" }, months, "NG").platforms).not.toContain("Ladda");
  });
});
