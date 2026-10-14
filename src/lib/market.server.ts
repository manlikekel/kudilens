import {
  annualised,
  correlation,
  type LiveValue,
  type MarketAssumptions,
} from "@/lib/finance/market";
import { latestSecReport, moneyMarketYield } from "@/lib/invest/sec.server";

/**
 * Builds live assumptions from free official sources. Each piece is fetched independently, so
 * one source being down only drops that value (the profile value is used instead). Cached 6h.
 *
 *  - Inflation: Central Bank of Nigeria API, latest headline year-on-year rate
 *  - Naira loss: today's rate vs the World Bank yearly average ten years earlier, annualised
 *  - Foreign inflation: US Bureau of Labor Statistics CPI-U, latest 12-month change
 *  - Inflation ↔ Naira correlation: World Bank yearly inflation vs yearly Naira change, 20 years
 *  - Cash share of inflation: SEC money market funds' NAV-weighted yield ÷ inflation
 *  - School fees: no public index, so headline inflation (flagged as an estimate)
 */

const TTL = 6 * 3600 * 1000;
let cached: { at: number; data: MarketAssumptions } | null = null;
const UA = { "User-Agent": "Mozilla/5.0 KudiLens" };
const round = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

interface CbnRow {
  tyear: number;
  tmonth: number;
  period: string;
  allItemsYearOn: string;
}

async function cbnInflation(): Promise<{ rate: number; period: string } | null> {
  const rows = await json<CbnRow[]>("https://www.cbn.gov.ng/api/GetAllInflationRates");
  const latest = rows
    .filter((r) => Number.isFinite(Number(r.allItemsYearOn)))
    .sort((a, b) => b.tyear - a.tyear || b.tmonth - a.tmonth)[0];
  return latest ? { rate: Number(latest.allItemsYearOn), period: latest.period } : null;
}

type WbRow = { date: string; value: number | null };
async function worldBank(indicator: string): Promise<Map<number, number>> {
  const out = await json<[unknown, WbRow[]]>(
    `https://api.worldbank.org/v2/country/NG/indicator/${indicator}?format=json&per_page=80`,
  );
  return new Map(
    (out[1] ?? []).filter((r) => r.value != null).map((r) => [Number(r.date), Number(r.value)]),
  );
}

async function ngnPerUsdToday(): Promise<{ rate: number; date: string } | null> {
  const body = await json<{ date: string; usd: Record<string, number> }>(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  );
  const rate = body.usd["ngn"];
  return rate ? { rate, date: body.date } : null;
}

async function ngnPerUsdOn(date: string): Promise<number | null> {
  const body = await json<{ usd: Record<string, number> }>(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`,
  );
  return body.usd["ngn"] ?? null;
}

interface BlsResponse {
  Results?: {
    series?: { data?: { year: string; period: string; periodName: string; value: string }[] }[];
  };
}
async function usInflation(): Promise<{ rate: number; period: string } | null> {
  const body = await json<BlsResponse>(
    "https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0",
  );
  const data = body.Results?.series?.[0]?.data ?? [];
  const latest = data[0];
  if (!latest) return null;
  const prior = data.find(
    (d) => d.period === latest.period && Number(d.year) === Number(latest.year) - 1,
  );
  if (!prior) return null;
  return {
    rate: (Number(latest.value) / Number(prior.value) - 1) * 100,
    period: `${latest.periodName} ${latest.year}`,
  };
}

const settle = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch (err) {
    console.warn("Live assumption source failed", err);
    return null;
  }
};

export async function marketAssumptions(): Promise<MarketAssumptions> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;

  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const [infl, fxNow, fxYearAgo, wbFx, wbInfl, us, sec] = await Promise.all([
    settle(cbnInflation()),
    settle(ngnPerUsdToday()),
    settle(ngnPerUsdOn(yearAgo)),
    settle(worldBank("PA.NUS.FCRF")),
    settle(worldBank("FP.CPI.TOTL.ZG")),
    settle(usInflation()),
    settle(latestSecReport()),
  ]);

  const out: MarketAssumptions = { fetchedAt: new Date().toISOString() };
  const v = (
    value: number,
    label: string,
    source: string,
    sourceUrl: string,
    asOf: string,
  ): LiveValue => ({
    value,
    label,
    source,
    sourceUrl,
    asOf,
  });

  if (infl) {
    out.inflation = v(
      round(infl.rate),
      "Headline inflation, latest 12 months",
      "Central Bank of Nigeria",
      "https://www.cbn.gov.ng/rates/inflrates.html",
      infl.period,
    );
    out.educationInflation = v(
      round(infl.rate),
      "No public school-fee index exists, so this uses headline inflation",
      "Central Bank of Nigeria (estimate)",
      "https://www.cbn.gov.ng/rates/inflrates.html",
      infl.period,
    );
  }

  if (fxNow && wbFx?.size) {
    // ten years back from the latest full year the World Bank has
    const latestYear = Math.max(...wbFx.keys());
    const baseYear = latestYear - 9;
    const base = wbFx.get(baseYear);
    if (base) {
      // a yearly average sits mid-year; measure the years from 1 July of that year to today
      const years = (Date.parse(fxNow.date) - Date.UTC(baseYear, 6, 1)) / (365.25 * 86_400_000);
      out.fxDepreciation = v(
        round(annualised(base, fxNow.rate, years) * 100),
        `Average yearly Naira loss vs $ since ${baseYear} (₦${Math.round(base)} → ₦${Math.round(fxNow.rate)})`,
        "World Bank and daily exchange rates",
        "https://data.worldbank.org/indicator/PA.NUS.FCRF?locations=NG",
        fxNow.date,
      );
    }
  }
  if (fxNow && fxYearAgo) {
    out.fxChange1y = v(
      round((fxNow.rate / fxYearAgo - 1) * 100),
      "Naira change over the last 12 months (negative means it strengthened)",
      "Daily exchange rates",
      "https://github.com/fawazahmed0/exchange-api",
      fxNow.date,
    );
  }

  if (us) {
    out.foreignInflation = v(
      round(us.rate),
      "US consumer prices, latest 12 months",
      "US Bureau of Labor Statistics",
      "https://www.bls.gov/cpi/",
      us.period,
    );
  }

  if (wbFx?.size && wbInfl?.size) {
    const years = [...wbInfl.keys()]
      .filter((y) => wbFx.has(y) && wbFx.has(y - 1))
      .sort((a, b) => b - a)
      .slice(0, 20);
    const dep = years.map((y) => wbFx.get(y)! / wbFx.get(y - 1)! - 1);
    const inf = years.map((y) => wbInfl.get(y)!);
    const r = correlation(inf, dep);
    if (r != null)
      out.inflationFxCorrelation = v(
        round(Math.max(-1, Math.min(1, r))),
        `How closely inflation and Naira weakness moved together, ${Math.min(...years)}–${Math.max(...years)}`,
        "World Bank",
        "https://data.worldbank.org/country/nigeria",
        String(Math.max(...years)),
      );
  }

  const mmf = sec ? moneyMarketYield(sec) : null;
  if (mmf != null && infl && infl.rate > 0) {
    out.cashYieldRatio = v(
      round(Math.max(0, Math.min(1.5, (mmf * 100) / infl.rate))),
      `Money market funds pay ${(mmf * 100).toFixed(1)}% vs ${infl.rate.toFixed(1)}% inflation (assumes your cash sits in one)`,
      "SEC Nigeria weekly report",
      sec!.source,
      sec!.weekEnded ?? "",
    );
  }

  cached = { at: Date.now(), data: out };
  return out;
}
