import { readValuationReport, type NgFundReport } from "./secnav";

/**
 * Finds and reads the newest SEC Nigeria weekly valuation report. The SEC lists each year's
 * reports on its own page; we take the highest-numbered .xlsx document from the current (or,
 * early in January, the previous) year. Cached for 12 hours per server instance.
 */

const BASE = "https://sec.gov.ng";
const yearPage = (y: number) =>
  `${BASE}/for-operators/keep-track-of-capital-market-data/net-asset-value-data/weekly-net-asset-value-for-cis/${y}-weekly-nav-for-cis/`;
const TTL = 12 * 3600 * 1000;

let cached: { at: number; report: NgFundReport & { source: string } } | null = null;

async function latestReportUrl(): Promise<string> {
  const year = new Date().getUTCFullYear();
  for (const y of [year, year - 1]) {
    const res = await fetch(yearPage(y), { headers: { "User-Agent": "Mozilla/5.0 KudiLens" } });
    if (!res.ok) continue;
    const html = await res.text();
    const docs = [...html.matchAll(/href="(\/documents\/(\d+)\/[^"]+\.xlsx)"/gi)].map((m) => ({
      path: m[1]!,
      id: Number(m[2]),
    }));
    if (docs.length) return BASE + docs.sort((a, b) => b.id - a.id)[0]!.path;
  }
  throw new Error("No SEC weekly report found");
}

export async function latestSecReport() {
  if (cached && Date.now() - cached.at < TTL) return cached.report;
  const url = await latestReportUrl();
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 KudiLens" } });
  if (!res.ok) throw new Error(`SEC report download failed (${res.status})`);
  const report = {
    ...(await readValuationReport(new Uint8Array(await res.arrayBuffer()))),
    source: url,
  };
  cached = { at: Date.now(), report };
  return report;
}

/** NAV-weighted average yield of Naira money market funds (a decimal), or null. */
export function moneyMarketYield(report: NgFundReport): number | null {
  const mm = report.funds.filter(
    (f) => /money market/i.test(f.category) && f.yieldYtd != null && f.nav,
  );
  const nav = mm.reduce((t, f) => t + f.nav!, 0);
  return nav > 0 ? mm.reduce((t, f) => t + f.yieldYtd! * f.nav!, 0) / nav : null;
}
