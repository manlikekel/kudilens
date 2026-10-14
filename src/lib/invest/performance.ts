/** Total-return figures from a monthly price series (adjusted closes include reinvested dividends). */

export interface PricePoint {
  t: number; // unix seconds
  close: number;
}

export interface Performance {
  price: number;
  /** since the last close of the previous calendar year */
  ytd: number | null;
  r1y: number | null;
  /** annualised */
  r3y: number | null;
  /** annualised */
  r5y: number | null;
}

const YEAR = 365.25 * 86_400;

export function performance(
  series: PricePoint[],
  adjusted: PricePoint[] = series,
): Performance | null {
  const pts = adjusted
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.t - b.t);
  const last = pts.at(-1);
  if (!last) return null;
  const raw = series.filter((p) => Number.isFinite(p.close) && p.close > 0).at(-1);

  const thisYear = new Date(last.t * 1000).getUTCFullYear();
  const prevYearEnd = [...pts]
    .reverse()
    .find((p) => new Date(p.t * 1000).getUTCFullYear() < thisYear);

  /** total return over `years`, annualised when years > 1; null if the history is too short */
  const over = (years: number) => {
    const target = last.t - years * YEAR;
    if (pts[0]!.t > target + 20 * 86_400) return null;
    const base = pts.find((p) => p.t >= target - 20 * 86_400) ?? pts[0]!;
    const total = last.close / base.close;
    return years > 1 ? Math.pow(total, 1 / years) - 1 : total - 1;
  };

  return {
    price: raw?.close ?? last.close,
    ytd: prevYearEnd ? last.close / prevYearEnd.close - 1 : null,
    r1y: over(1),
    r3y: over(3),
    r5y: over(5),
  };
}
