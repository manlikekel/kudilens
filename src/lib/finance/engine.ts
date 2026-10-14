import { LIQUID_CLASSES, summarize, type FinanceData } from "./core";
import { ASSET_VOLATILITY, PHYSICAL_VOLATILITY, getAssumptions, toNGN } from "./assumptions";
import { roundMoney } from "./money";

export interface PathYear {
  cash: number;
  investments: number;
  assets: number;
  debt: number;
  netWorth: number; // NGN nominal
  real: number; // today's NGN
  usd: number;
}

export interface EngineOptions {
  /** 0 = no randomness at all; 1 = full volatility */
  volScale?: number;
  extraMonthly?: number; // NGN per month freed up (e.g. spending cuts)
}

/**
 * One yearly path of the household balance sheet in Naira. `draw` returns a standard-normal
 * shock; pass `null` for the deterministic median path. Shared by project() and monteCarlo()
 * so both engines use identical assumptions.
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
  const expenses0 = base(s.monthlyExpenses + s.familyCost) * 12;
  const extra = (opts.extraMonthly ?? 0) * 12;

  const pots = data.investments.map((i) => ({
    cur: i.currency,
    value: Number(i.current_value) || 0, // own currency
    yearly: (Number(i.monthly_contribution) || 0) * 12,
    mu: (Number(i.expected_return) || 0) / 100,
    sigma: (ASSET_VOLATILITY[i.asset_class] ?? 20) / 100,
    liquid: LIQUID_CLASSES.has(i.asset_class),
  }));
  const physical = (data.assets ?? []).map((x) => ({
    cur: x.currency,
    value: Number(x.current_value) || 0,
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
  const lognormal = (mu: number, sigma: number) => {
    const sg = sigma * vs;
    return Math.exp(Math.log(1 + mu) - (sg * sg) / 2 + sg * z()) - 1;
  };
  const inNGN = (value: number, cur: string) => (cur === "NGN" ? value : value * fxNow(cur) * fxIndex);

  const snapshot = (): PathYear => {
    const inv = pots.reduce((t, p) => t + inNGN(p.value, p.cur), 0);
    const ast = physical.reduce((t, p) => t + inNGN(p.value, p.cur), 0);
    const debt = loans.reduce((t, l) => t + inNGN(Math.max(0, l.balance), l.cur), 0) + Math.max(0, -cash);
    const nw = Math.max(0, cash) + inv + ast - debt;
    const usdRate = a.ngnPerUSD * fxIndex;
    return { cash, investments: inv, assets: ast, debt, netWorth: nw, real: nw / cpi, usd: Number.isFinite(usdRate) ? nw / usdRate : 0 };
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
    for (const p of pots) {
      const add = p.yearly * (a.growContributions ? grow : 1);
      p.value = p.value * (1 + lognormal(p.mu, p.sigma)) + add;
      contributions += inNGN(add, p.cur);
    }
    for (const p of physical) p.value *= 1 + lognormal(p.mu, p.sigma);

    let debtPaid = 0;
    for (const l of loans) {
      if (l.balance <= 0) continue;
      const owed = l.balance * (1 + l.r);
      const paid = Math.min(l.pay, owed);
      l.balance = owed - paid;
      debtPaid += inNGN(paid, l.cur);
    }

    // surplus can be negative: it draws down cash first, then liquid then other investments
    const surplus = income - expenses - debtPaid - contributions + extra;
    cash = (cash > 0 ? cash * (1 + infl * a.cashYieldRatio) : cash) + surplus;
    if (cash < 0) {
      for (const group of [pots.filter((p) => p.liquid), pots.filter((p) => !p.liquid)]) {
        const total = group.reduce((t, p) => t + inNGN(p.value, p.cur), 0);
        if (total <= 0 || cash >= 0) continue;
        const f = Math.min(1, -cash / total);
        for (const p of group) p.value *= 1 - f;
        cash += total * f;
      }
    }
    out.push(snapshot());
  }
  return out;
}

export interface ProjectionPoint {
  year: number;
  age: number | null;
  investments: number;
  debt: number;
  netWorth: number;
  realNetWorth: number;
}

/** Deterministic median projection in the user's base currency (same engine as the Monte Carlo). */
export function project(data: FinanceData, years = 25, extraMonthly = 0, volScale = 1): ProjectionPoint[] {
  const a = getAssumptions(data);
  const base = data.profile?.base_currency ?? "NGN";
  const extraNGN = toNGN(extraMonthly, base, a);
  const path = simulatePath(data, years, null, { volScale, extraMonthly: extraNGN });
  const y0 = new Date().getFullYear();
  const age = data.profile?.age ?? null;
  const toBase = (ngn: number) => (base === "NGN" ? ngn : ngn / Math.max(1e-9, toNGN(1, base, a)));
  return path.map((p, i) => {
    const fx = Math.pow(1 + a.fxDepreciation, i); // median Naira path
    const conv = (ngn: number) => (base === "NGN" ? ngn : toBase(ngn) / fx);
    return {
      year: y0 + i,
      age: age != null ? age + i : null,
      investments: roundMoney(conv(p.investments + Math.max(0, p.cash) + p.assets)),
      debt: roundMoney(conv(p.debt)),
      netWorth: roundMoney(conv(p.netWorth)),
      realNetWorth: roundMoney(conv(p.real)),
    };
  });
}
