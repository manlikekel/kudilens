import { describe, expect, it } from "vitest";
import { applyRules, averageActualSpend, cleanMerchant, dedupeKey, detectRecurring, guessMapping, monthlySpending, parseAmountMinor, parseCSV, parseDate, rowsToTxns } from "./transactions";
import { forecastCash } from "./cashflow";

describe("statement parsing", () => {
  it("finds the header below bank preamble and maps GTBank-style debit/credit columns", () => {
    const csv = `Account Name,JOHN DOE\nAccount No,0123\n\nTrans. Date,Value Date,Narration,Debit,Credit,Balance\n03-Jan-2026,03-Jan-2026,"POS PURCHASE @ SHOPRITE IKEJA REF 99887766",12,500.00,,100000\n05/01/2026,05/01/2026,SALARY JAN,,"450,000.00",550000`;
    const t = parseCSV(csv);
    expect(t.headers[2]).toBe("Narration");
    const m = guessMapping(t.headers);
    expect(m).toMatchObject({ date: 0, description: 2, debit: 3, credit: 4 });
  });
  it("parses amounts and dates in Nigerian formats", () => {
    expect(parseAmountMinor("₦12,500.50")).toBe(1250050);
    expect(parseAmountMinor("(2,000)")).toBe(-200000);
    expect(parseAmountMinor("-50")).toBe(-5000);
    expect(parseAmountMinor("")).toBeNull();
    expect(parseDate("03-Jan-2026")).toBe("2026-01-03");
    expect(parseDate("05/02/2026")).toBe("2026-02-05"); // day first
    expect(parseDate("2026-03-09 10:22")).toBe("2026-03-09");
    expect(parseDate("not a date")).toBeNull();
  });
  it("de-duplicates on re-import but keeps genuine same-day duplicates", () => {
    const table = { headers: ["Date", "Narration", "Amount"], rows: [["01/02/2026", "AIRTIME MTN", "-100"], ["01/02/2026", "AIRTIME MTN", "-100"]] };
    const a = rowsToTxns(table, { date: 0, description: 1, amount: 2, debit: -1, credit: -1 });
    const b = rowsToTxns(table, { date: 0, description: 1, amount: 2, debit: -1, credit: -1 });
    expect(a.txns).toHaveLength(2);
    expect(new Set(a.txns.map((t) => t.dedupe_key)).size).toBe(2);
    expect(a.txns.map((t) => t.dedupe_key)).toEqual(b.txns.map((t) => t.dedupe_key));
    expect(dedupeKey("2026-01-01", -100, "x  y")).toBe(dedupeKey("2026-01-01", -100, "X Y"));
  });
  it("cleans merchant names", () => {
    expect(cleanMerchant("POS PURCHASE @ SHOPRITE IKEJA REF 99887766")).toBe("SHOPRITE IKEJA");
  });
});

describe("categorisation", () => {
  it("user rules beat built-in rules", () => {
    expect(applyRules("SHOPRITE IKEJA", "", -100)).toBe("Groceries");
    expect(applyRules("SHOPRITE IKEJA", "", -100, [{ pattern: "shoprite", category: "Shopping" }])).toBe("Shopping");
    expect(applyRules("DSTV", "", -100)).toBe("Subscriptions");
    expect(applyRules("UNKNOWN CO", "", 5000)).toBe("Other income");
  });
});

describe("recurring + monthly spend", () => {
  const tx = [
    { txn_date: "2026-01-05", amount_minor: -2900000, merchant: "DSTV", category: "Subscriptions" },
    { txn_date: "2026-02-04", amount_minor: -2900000, merchant: "DSTV", category: "Subscriptions" },
    { txn_date: "2026-03-06", amount_minor: -3100000, merchant: "DSTV", category: "Subscriptions" },
    { txn_date: "2026-01-10", amount_minor: -500000, merchant: "SHOPRITE", category: "Groceries" },
    { txn_date: "2026-01-11", amount_minor: -9000000, merchant: "SHOPRITE", category: "Groceries" },
    { txn_date: "2026-01-25", amount_minor: 45000000, merchant: "SALARY", category: "Salary" },
    { txn_date: "2026-01-26", amount_minor: -10000000, merchant: "OWN SAVINGS", category: "Savings & investing" },
  ];
  it("detects monthly subscriptions and ignores irregular spending", () => {
    const r = detectRecurring(tx);
    expect(r.map((x) => x.merchant)).toEqual(["DSTV"]);
    expect(r[0].isSubscription).toBe(true);
    expect(r[0].typicalMinor).toBe(2900000);
  });
  it("monthly spend excludes savings transfers; average excludes current month", () => {
    const m = monthlySpending(tx);
    expect(m[0]).toMatchObject({ month: "2026-01", incomeMinor: 45000000, spendMinor: 2900000 + 500000 + 9000000 });
    const avg = averageActualSpend(m, new Date("2026-03-15"));
    expect(avg.months).toBe(2);
  });
  it("cash forecast uses actual spend when available", () => {
    const base = { profile: null, debts: [], investments: [], family: [], fxRates: [{ currency: "NGN", per_usd: 1500, as_of: "2026-01-01", source: "t" }],
      flows: [{ id: "1", user_id: "u", label: "Salary", flow_type: "income", category: "salary", monthly_amount: 500000, currency: "NGN", growth_rate: 0, notes: null, created_at: "" },
              { id: "2", user_id: "u", label: "Living", flow_type: "expense", category: "general", monthly_amount: 200000, currency: "NGN", growth_rate: 0, notes: null, created_at: "" }] } as never;
    const est = forecastCash(base);
    const act = forecastCash({ ...(base as object), actualSpend: { avgMonthly: 350000, months: 3 } } as never);
    expect(est.usesActual).toBe(false);
    expect(act.usesActual).toBe(true);
    expect(est.months[0].regular - act.months[0].regular).toBeCloseTo(-150000);
  });
});
