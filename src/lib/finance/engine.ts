import { LIQUID_CLASSES, summarize, type FinanceData } from "./core";
import { ASSET_VOLATILITY, PHYSICAL_VOLATILITY, getAssumptions, toNGN } from "./assumptions";
import { convert } from "./fx";
import { roundMoney } from "./money";

export interface PathYear {
  cash: number;
  investments: number;
  assets: number;
  debt: number;
  netWorth: number; // NGN nominal
  real: number; // today's NGN
  usd: number;
  /** What moved net worth during this year. Absent for the starting point. */
  change?: YearChange;
}

/** One year's net worth change split by source; the parts add up to `total`. */
export interface YearChange {
  /**
   * Income − living and family costs (+ extra saving) is split three ways:
   * paid to debts (lowers what you owe), added to investments, and what's left kept as cash
   * (negative when income falls short).
   */
  debtPaid: number;
  contributions: number;
  keptAsCash: number;
  investmentReturns: number;
  assetGrowth: number;
  cashInterest: number;
  debtInterest: number; // negative
  /** foreign-currency items repriced as the Naira moves */
  fxRevaluation: number;
  total: number;
}

export interface EngineOptions {
  /** 0 = no randomness at all; 1 = full volatility */
  volScale?: number;
  extraMonthly?: number; // NGN per month freed up (e.g. spending cuts)
  /**
   * "compound" (default): each year's growth is earned on the whole balance, including past growth.
   * "simple": growth is earned only on what was put in (starting value + contributions).
   */
  interest?: InterestMode;
  /**
   * true: investments are never sold to cover a shortfall; debts and bills are paid from income only
   * and any gap shows up as a cash shortfall (counted as debt). false (default): cash first, then
   * liquid pots, then the rest.
   */
  protectInvestments?: boolean;
  /**
   * true: living and family costs use the user's actual average monthly spending from imported
   * statements (when there is any) instead of the amounts typed in My numbers.
   */
  actualSpending?: boolean;
  /** what-if scenario: extra money in (+) or out (−) during projected year y, in Naira */
  scenario?: (y: number) => number;
}

/**
 * One line of a what-if scenario, in the user's base currency. Positive amounts add money
 * (a raise, a windfall, a cost you cut); negative ones take it away (a purchase, a new bill).
 */
export interface ScenarioChange {
  kind: "oneOff" | "monthly";
  label: string;
  amount: number;
  /** calendar year it happens (one-off) or starts (monthly) */
  year: number;
  /** last calendar year a monthly change applies; open-ended when missing */
  endYear?: number | undefined;
}

export type InterestMode = "compound" | "simple";

/**
 * One yearly path of the household balance sheet in Naira. `draw` returns a standard-normal
 * shock; pass `null` for the deterministic expected path, where every pot compounds at exactly
 * its expected return. Shared by project() and monteCarlo() so both engines use identical assumptions.
 */
export function simulatePath(
  data: FinanceData,
  years: number,
  draw: (() => number) | null,
  opts: EngineOptions = {},
): PathYear[] {
  const a = getAssumptions(data);
  const s = summarize(data);
  const vs = opts.volScale ?? 1;
  const z = () => (draw ? draw() : 0);
  const base = (x: number) => toNGN(x, s.currency, a);
  const fxNow = (cur: string) => toNGN(1, cur, a); // NGN per unit today

  const income0 = base(s.monthlyIncome) * 12;
  const useActual = !!opts.actualSpending && (data.actualSpend?.months ?? 0) > 0;
  // actualSpend is already in Naira and excludes transfers, savings and debt repayments
  const expenses0 = useActual
    ? data.actualSpend!.avgMonthly * 12
    : base(s.monthlyExpenses + s.familyCost) * 12;
  const extra = (opts.extraMonthly ?? 0) * 12;

  const pots = data.investments.map((i) => ({
    cur: i.currency,
    value: Number(i.current_value) || 0, // own currency
    principal: Number(i.current_value) || 0, // paid in, own currency (simple interest base)
    yearly: (Number(i.monthly_contribution) || 0) * 12,
    mu: (Number(i.expected_return) || 0) / 100,
    sigma: (ASSET_VOLATILITY[i.asset_class] ?? 20) / 100,
    liquid: LIQUID_CLASSES.has(i.asset_class),
  }));
  const physical = (data.assets ?? []).map((x) => ({
    cur: x.currency,
    value: Number(x.current_value) || 0,
    principal: Number(x.current_value) || 0,
    mu: (Number(x.appreciation) || 0) / 100,
    sigma: (PHYSICAL_VOLATILITY[x.kind] ?? 15) / 100,
  }));
  // Debts stay in their own currency so a USD loan grows in Naira terms as the Naira weakens.
  const loans = data.debts.map((d) => ({
    cur: d.currency,
    balance: Number(d.balance) || 0,
    r: (Number(d.interest_rate) || 0) / 100,
    pay: (Number(d.minimum_payment) || 0) * 12,
  }));

  let cash = (data.accounts ?? []).reduce((t, x) => t + toNGN(x.balance, x.currency, a), 0);
  let fxIndex = 1; // Naira weakness vs today
  let cpi = 1;
  const rho = a.infFxCorrelation;
  const simple = opts.interest === "simple";
  // Random paths are lognormal with mean `mu`. The deterministic path uses `mu` itself so it
  // compounds at the rate the user typed, not the lower lognormal median.
  const lognormal = (mu: number, sigma: number) => {
    if (!draw) return mu;
    const sg = sigma * vs;
    return Math.exp(Math.log(1 + mu) - (sg * sg) / 2 + sg * z()) - 1;
  };
  const inNGN = (value: number, cur: string) =>
    cur === "NGN" ? value : value * fxNow(cur) * fxIndex;

  const snapshot = (): PathYear => {
    const inv = pots.reduce((t, p) => t + inNGN(p.value, p.cur), 0);
    const ast = physical.reduce((t, p) => t + inNGN(p.value, p.cur), 0);
    const debt =
      loans.reduce((t, l) => t + inNGN(Math.max(0, l.balance), l.cur), 0) + Math.max(0, -cash);
    const nw = Math.max(0, cash) + inv + ast - debt;
    const usdRate = a.ngnPerUSD * fxIndex;
    return {
      cash,
      investments: inv,
      assets: ast,
      debt,
      netWorth: nw,
      real: nw / cpi,
      usd: Number.isFinite(usdRate) ? nw / usdRate : 0,
    };
  };

  const out: PathYear[] = [snapshot()];
  for (let y = 1; y <= years; y++) {
    // correlated shocks: Naira depreciation and inflation move together
    const zFx = z();
    const zInf = rho * zFx + Math.sqrt(1 - rho * rho) * z();
    const infl = Math.max(-0.05, a.inflation + vs * a.inflationVolatility * zInf);
    const dep = Math.max(-0.5, a.fxDepreciation + vs * a.fxVolatility * zFx);
    const prevCpi = cpi;
    cpi *= 1 + infl;
    fxIndex *= 1 + dep;

    const grow = Math.pow(1 + a.salaryGrowth, y - 1);
    const income = income0 * grow;
    const expenses = expenses0 * prevCpi;

    let contributions = 0;
    let investmentReturns = 0;
    for (const p of pots) {
      const add = p.yearly * (a.growContributions ? grow : 1);
      const gain = (simple ? p.principal : p.value) * lognormal(p.mu, p.sigma);
      p.value += gain + add;
      p.principal += add;
      contributions += inNGN(add, p.cur);
      investmentReturns += inNGN(gain, p.cur);
    }
    let assetGrowth = 0;
    for (const p of physical) {
      const gain = (simple ? p.principal : p.value) * lognormal(p.mu, p.sigma);
      p.value += gain;
      assetGrowth += inNGN(gain, p.cur);
    }

    let debtPaid = 0;
    let debtInterest = 0;
    for (const l of loans) {
      if (l.balance <= 0) continue;
      const interest = l.balance * l.r;
      const paid = Math.min(l.pay, l.balance + interest);
      l.balance += interest - paid;
      debtPaid += inNGN(paid, l.cur);
      debtInterest += inNGN(interest, l.cur);
    }

    // surplus can be negative: it draws down cash first, then (unless investments are protected)
    // liquid then other investments
    const surplus =
      income - expenses - debtPaid - contributions + extra + (opts.scenario ? opts.scenario(y) : 0);
    const cashInterest = cash > 0 ? cash * infl * a.cashYieldRatio : 0;
    cash += cashInterest + surplus;
    if (cash < 0 && !opts.protectInvestments) {
      for (const group of [pots.filter((p) => p.liquid), pots.filter((p) => !p.liquid)]) {
        const total = group.reduce((t, p) => t + inNGN(p.value, p.cur), 0);
        if (total <= 0 || cash >= 0) continue;
        const f = Math.min(1, -cash / total);
        for (const p of group) {
          p.value *= 1 - f;
          p.principal *= 1 - f;
        }
        cash += total * f;
      }
    }
    const snap = snapshot();
    const total = snap.netWorth - out[y - 1]!.netWorth;
    const explained =
      debtPaid +
      contributions +
      surplus +
      investmentReturns +
      assetGrowth +
      cashInterest -
      debtInterest;
    snap.change = {
      debtPaid,
      contributions,
      keptAsCash: surplus,
      investmentReturns,
      assetGrowth,
      cashInterest,
      debtInterest: -debtInterest,
      fxRevaluation: total - explained,
      total,
    };
    out.push(snap);
  }
  return out;
}

export interface ProjectionPoint {
  year: number;
  age: number | null;
  /** investment pots only (not cash or property) */
  investments: number;
  cash: number;
  assets: number;
  debt: number;
  netWorth: number;
  realNetWorth: number;
  change?: YearChange;
}

/**
 * Deterministic expected projection in the user's base currency: the same engine as the Monte
 * Carlo without the randomness, so every pot compounds at exactly its expected return.
 */
export function project(
  data: FinanceData,
  years = 25,
  extraMonthly = 0,
  opts: Pick<EngineOptions, "interest" | "protectInvestments" | "actualSpending"> & {
    changes?: ScenarioChange[];
  } = {},
): ProjectionPoint[] {
  const a = getAssumptions(data);
  const base = data.profile?.base_currency ?? "NGN";
  const extraNGN = toNGN(extraMonthly, base, a);
  const y0 = new Date().getFullYear();
  const { changes, ...engineOpts } = opts;
  // projected year y covers calendar year y0 + y; anything dated this year lands in year 1
  const scenario = changes?.length
    ? (y: number) =>
        changes.reduce((t, c) => {
          const at = (year: number) => Math.max(1, year - y0);
          if (c.kind === "oneOff") return at(c.year) === y ? t + toNGN(c.amount, base, a) : t;
          const active = y >= at(c.year) && (c.endYear == null || y <= at(c.endYear));
          return active ? t + toNGN(c.amount, base, a) * 12 : t;
        }, 0)
    : undefined;
  const path = simulatePath(data, years, null, {
    ...engineOpts,
    extraMonthly: extraNGN,
    ...(scenario ? { scenario } : {}),
  });
  const age = data.profile?.age ?? null;
  const toBase = (ngn: number) => (base === "NGN" ? ngn : ngn / Math.max(1e-9, toNGN(1, base, a)));
  const out: ProjectionPoint[] = [];
  path.forEach((p, i) => {
    const fx = Math.pow(1 + a.fxDepreciation, i); // median Naira path
    const conv = (ngn: number) => roundMoney(base === "NGN" ? ngn : toBase(ngn) / fx);
    const point: ProjectionPoint = {
      year: y0 + i,
      age: age != null ? age + i : null,
      investments: conv(p.investments),
      cash: conv(Math.max(0, p.cash)),
      assets: conv(p.assets),
      debt: conv(p.debt),
      netWorth: conv(p.netWorth),
      realNetWorth: conv(p.real),
    };
    const c = p.change;
    if (c && i > 0) {
      // re-split in the base currency; whatever the parts don't explain is currency movement
      const parts = {
        debtPaid: conv(c.debtPaid),
        contributions: conv(c.contributions),
        keptAsCash: conv(c.keptAsCash),
        investmentReturns: conv(c.investmentReturns),
        assetGrowth: conv(c.assetGrowth),
        cashInterest: conv(c.cashInterest),
        debtInterest: conv(c.debtInterest),
      };
      const total = point.netWorth - out[i - 1]!.netWorth;
      const explained = Object.values(parts).reduce((t, x) => t + x, 0);
      point.change = { ...parts, fxRevaluation: total - explained, total };
    }
    out.push(point);
  });
  return out;
}

export interface PotGrowth {
  id: string;
  name: string;
  currency: string;
  ratePct: number;
  /** monthly contribution today, base currency */
  monthly: number;
  /** value at the end of each year, index 0 = today (base currency at today's rates) */
  values: number[];
  /** total paid in over the horizon, base currency */
  contributed: number;
  formula: string;
}

/**
 * Each investment on its own: today's value compounding at its expected return, plus the
 * yearly contribution added at each year end (rising with salary growth when that setting is
 * on) — the same rule the engine uses. Shown at today's exchange rates so the growth comes from
 * the user's rate and nothing else.
 */
export function investmentGrowth(
  data: FinanceData,
  years = 25,
  interest: InterestMode = "compound",
): PotGrowth[] {
  const a = getAssumptions(data);
  const base = data.profile?.base_currency ?? "NGN";
  const toBase = (x: number, cur: string) => convert(x, cur, base, a.rates);
  const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;
  return data.investments.map((inv) => {
    const r = (Number(inv.expected_return) || 0) / 100;
    const monthly = Number(inv.monthly_contribution) || 0;
    let v = Number(inv.current_value) || 0;
    let contributed = 0;
    let principal = v;
    const values = [roundMoney(toBase(v, inv.currency))];
    for (let y = 1; y <= years; y++) {
      const add = monthly * 12 * (a.growContributions ? Math.pow(1 + a.salaryGrowth, y - 1) : 1);
      v += (interest === "simple" ? principal : v) * r + add;
      principal += add;
      contributed += add;
      values.push(roundMoney(toBase(v, inv.currency)));
    }
    const contrib = monthly
      ? `, then add ${monthly.toLocaleString()} ${inv.currency} × 12` +
        (a.growContributions
          ? ` (the monthly amount rises ${pct(a.salaryGrowth)} a year with your salary growth)`
          : "")
      : "";
    return {
      id: inv.id,
      name: inv.name,
      currency: inv.currency,
      ratePct: r * 100,
      monthly: roundMoney(toBase(monthly, inv.currency)),
      values,
      contributed: roundMoney(toBase(contributed, inv.currency)),
      formula:
        (interest === "simple"
          ? `Simple interest: each year adds ${pct(r)} of what you've put in (not of past growth)${contrib}. `
          : `Compound interest: each year, last year's value × (1 + ${pct(r)})${contrib}. `) +
        (inv.currency === base ? "" : `Converted to ${base} at today's rate. `) +
        "No market ups and downs here; the Plan tab shows the range.",
    };
  });
}
