import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { FinanceData, Snapshot } from "@/lib/finance";

/**
 * Demo mode: explore KudiLens with sample numbers, no account. The flag lives in sessionStorage
 * (gone when the tab closes). Reads come from the sample data below; every database write is
 * refused with a friendly message, so nothing can be saved by accident.
 */

const KEY = "kudi-demo";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000000";
export const DEMO_MESSAGE = "Demo mode: create a free account to save your own numbers.";

export function isDemo() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function startDemo() {
  sessionStorage.setItem(KEY, "1");
  guardWrites();
}

export function exitDemo() {
  sessionStorage.removeItem(KEY);
  window.location.assign("/auth");
}

export const DEMO_USER = {
  id: DEMO_USER_ID,
  email: "ada@demo.kudilens",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Ada", country: "NG", live_assumptions: true },
  identities: [],
  created_at: new Date().toISOString(),
} as unknown as User;

/* ---------------- refuse writes ---------------- */

let guarded = false;

/** A query-builder stand-in: every chained call returns itself and awaiting it gives an error. */
function refused(): unknown {
  const result = {
    data: null,
    error: { message: DEMO_MESSAGE, code: "demo" },
    count: null,
    status: 403,
  };
  const proxy: unknown = new Proxy(() => undefined, {
    get: (_t, prop) =>
      prop === "then"
        ? (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
        : () => proxy,
    apply: () => proxy,
  });
  return proxy;
}

/** Makes insert/update/upsert/delete on every table resolve to a demo-mode error. */
export function guardWrites() {
  if (guarded || !isDemo()) return;
  guarded = true;
  // The exported client is a read-only proxy, but supabase.from() delegates to rest.from() on
  // the real PostgREST client, which can be wrapped.
  const rest = (supabase as unknown as { rest: { from: (t: string) => unknown } }).rest;
  const from = rest.from.bind(rest);
  rest.from = (table: string) => {
    const builder = from(table) as Record<string, unknown>;
    return new Proxy(builder, {
      get: (target, prop, receiver) =>
        ["insert", "update", "upsert", "delete"].includes(String(prop))
          ? () => refused()
          : Reflect.get(target, prop, receiver),
    });
  };
}

/* ---------------- sample data ---------------- */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const year = new Date().getFullYear();

export function demoData(): FinanceData {
  return {
    profile: {
      id: DEMO_USER_ID,
      full_name: "Ada",
      age: 32,
      retirement_age: 60,
      base_currency: "NGN",
      inflation_rate: 18,
      risk_tolerance: "balanced",
      goals: "Buy land, children's school fees, relocate to Canada",
      salary_growth: 10,
      fx_depreciation: 15,
      education_inflation: 20,
      cash_yield_ratio: 0.5,
      income_stability: "stable",
    },
    flows: [
      {
        id: "f1",
        label: "Salary",
        flow_type: "income",
        category: "Salary",
        monthly_amount: 850_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "f2",
        label: "Side business",
        flow_type: "income",
        category: "Other income",
        monthly_amount: 150_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "f3",
        label: "Rent",
        flow_type: "expense",
        category: "Rent & housing",
        monthly_amount: 180_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "f4",
        label: "Food & household",
        flow_type: "expense",
        category: "Groceries",
        monthly_amount: 150_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "f5",
        label: "Transport & fuel",
        flow_type: "expense",
        category: "Transport",
        monthly_amount: 90_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "f6",
        label: "Bills & data",
        flow_type: "expense",
        category: "Utilities",
        monthly_amount: 60_000,
        currency: "NGN",
        growth_rate: 0,
      },
      {
        id: "f7",
        label: "Everything else",
        flow_type: "expense",
        category: "Other",
        monthly_amount: 80_000,
        currency: "NGN",
        growth_rate: 0,
      },
    ],
    family: [
      {
        id: "k1",
        name: "Tobi",
        relationship: "child",
        age: 4,
        dependent: true,
        monthly_cost: 60_000,
        currency: "NGN",
      },
    ],
    accounts: [
      {
        id: "a1",
        name: "GTBank savings",
        kind: "bank",
        balance: 1_200_000,
        currency: "NGN",
        is_emergency_fund: true,
      },
      {
        id: "a2",
        name: "Kuda current",
        kind: "bank",
        balance: 250_000,
        currency: "NGN",
        is_emergency_fund: false,
      },
    ],
    investments: [
      {
        id: "i1",
        name: "Money market fund",
        asset_class: "money market",
        current_value: 2_500_000,
        currency: "NGN",
        monthly_contribution: 100_000,
        expected_return: 17,
        notes: null,
      },
      {
        id: "i2",
        name: "US index fund",
        asset_class: "stocks",
        current_value: 3_000,
        currency: "USD",
        monthly_contribution: 50,
        expected_return: 10,
        notes: null,
      },
    ],
    assets: [
      {
        id: "p1",
        name: "Land in Ibeju-Lekki",
        kind: "land",
        current_value: 8_000_000,
        currency: "NGN",
        appreciation: 12,
        liquid: false,
      },
    ],
    debts: [
      {
        id: "d1",
        name: "Car loan",
        kind: "car loan",
        balance: 3_500_000,
        currency: "NGN",
        interest_rate: 22,
        minimum_payment: 180_000,
        notes: null,
      },
      {
        id: "d2",
        name: "Credit card",
        kind: "credit card",
        balance: 400_000,
        currency: "NGN",
        interest_rate: 30,
        minimum_payment: 40_000,
        notes: null,
      },
    ],
    goals: [
      {
        id: "g1",
        name: "Tobi's school fees fund",
        target_amount: 6_000_000,
        currency: "NGN",
        target_year: year + 4,
        target_month: 9,
        current_saved: 500_000,
        monthly_contribution: 50_000,
        priority: 1,
        saved_in: "money market",
      },
      {
        id: "g2",
        name: "Relocate to Canada",
        target_amount: 25_000,
        currency: "CAD",
        target_year: year + 3,
        target_month: 6,
        current_saved: 0,
        monthly_contribution: 0,
        priority: 2,
        saved_in: "money market",
      },
    ],
    lumps: [
      {
        id: "l1",
        label: "School fees",
        amount: 350_000,
        currency: "NGN",
        months: [1, 5, 9],
        saved: 120_000,
      },
    ],
    fxRates: [
      { currency: "NGN", per_usd: 1330, as_of: new Date().toISOString() },
      { currency: "GBP", per_usd: 0.75, as_of: new Date().toISOString() },
      { currency: "EUR", per_usd: 0.86, as_of: new Date().toISOString() },
      { currency: "CAD", per_usd: 1.38, as_of: new Date().toISOString() },
    ],
    actualSpend: { avgMonthly: 610_000, months: 3 },
  };
}

/** About four months of transactions, with subscriptions and bills to find. */
export function demoTxns() {
  const out: {
    txn_date: string;
    amount_minor: number;
    category: string;
    currency: string;
    merchant: string;
    description: string | null;
  }[] = [];
  const now = new Date();
  const add = (d: Date, naira: number, category: string, merchant: string) =>
    d <= now &&
    out.push({
      txn_date: iso(d),
      amount_minor: Math.round(naira * 100),
      category,
      currency: "NGN",
      merchant,
      description: null,
    });
  for (let back = 3; back >= 0; back--) {
    const m = (day: number) => new Date(now.getFullYear(), now.getMonth() - back, day);
    add(m(1), 850_000, "Salary", "EMPLOYER SALARY");
    add(m(2), -180_000, "Rent & housing", "LANDLORD RENT");
    add(m(5), -29_500, "Subscriptions", "DSTV MULTICHOICE");
    add(m(12), -7_000, "Subscriptions", "NETFLIX COM");
    add(m(18), -4_900, "Subscriptions", "SHOWMAX");
    add(m(6), -38_000, "Groceries", "SHOPRITE LEKKI");
    add(m(14), -42_000, "Groceries", "SPAR VI");
    add(m(22), -35_000, "Groceries", "MARKET SQUARE");
    add(m(8), -25_000, "Fuel", "TOTALENERGIES");
    add(m(20), -27_000, "Fuel", "MRS FILLING STATION");
    add(m(10), -15_000, "Airtime & data", "MTN DATA");
    add(m(16), -18_500, "Eating out", "CHICKEN REPUBLIC");
    add(m(25), -12_000, "Transport", "BOLT RIDES");
    add(m(26), -180_000, "Debt repayment", "CAR LOAN REPAYMENT");
  }
  return out;
}

export function demoSnapshots(): Snapshot[] {
  const now = new Date();
  return [9.2, 9.9, 10.6, 11.1, 11.9, 12.4].map((nw, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      currency: "NGN",
      net_worth: nw * 1_000_000,
      investments: 6_000_000 + i * 150_000,
      cash: 1_300_000 + i * 30_000,
      assets: 8_000_000,
      debt: 4_600_000 - i * 140_000,
    };
  });
}

export const DEMO_BUDGETS = [
  { id: "b1", category: "Groceries", monthly_limit: 120_000, currency: "NGN" },
  { id: "b2", category: "Fuel", monthly_limit: 50_000, currency: "NGN" },
  { id: "b3", category: "Eating out", monthly_limit: 25_000, currency: "NGN" },
  { id: "b4", category: "Subscriptions", monthly_limit: 30_000, currency: "NGN" },
];
