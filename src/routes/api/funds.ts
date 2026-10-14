import { createFileRoute } from "@tanstack/react-router";
import { FUNDS } from "@/lib/invest/directory";
import { performance, type Performance, type PricePoint } from "@/lib/invest/performance";

/**
 * Live performance for the funds listed in the directory for one country. Prices come from
 * Yahoo Finance's public chart endpoint (free, no key, unofficial), cached for six hours per
 * server instance. Only directory symbols can be requested, so this can't be used as an open proxy.
 */

export interface FundQuote extends Performance {
  symbol: string;
  currency: string;
}

const TTL = 6 * 3600 * 1000;
const cache = new Map<string, { at: number; quotes: FundQuote[] }>();

interface ChartResponse {
  chart?: {
    result?: {
      meta?: { currency?: string };
      timestamp?: number[];
      indicators?: {
        quote?: { close?: (number | null)[] }[];
        adjclose?: { adjclose?: (number | null)[] }[];
      };
    }[];
  };
}

async function quote(symbol: string): Promise<FundQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6y&interval=1mo`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 KudiLens" } });
  if (!res.ok) return null;
  const body = (await res.json()) as ChartResponse;
  const r = body.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const adj = r?.indicators?.adjclose?.[0]?.adjclose ?? closes;
  const toPoints = (xs: (number | null)[]): PricePoint[] =>
    ts.map((t, i) => ({ t, close: Number(xs[i]) })).filter((p) => p.close > 0);
  const perf = performance(toPoints(closes), toPoints(adj));
  if (!perf) return null;
  // London listings are quoted in pence
  let currency = r?.meta?.currency ?? "";
  if (currency === "GBp" || currency === "GBX") {
    currency = "GBP";
    perf.price /= 100;
  }
  return { symbol, currency, ...perf };
}

export const Route = createFileRoute("/api/funds")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const country = new URL(request.url).searchParams.get("country") ?? "";
        const funds = FUNDS[country as keyof typeof FUNDS];
        if (!funds) return Response.json({ asOf: null, quotes: [] });

        const hit = cache.get(country);
        let quotes = hit && Date.now() - hit.at < TTL ? hit.quotes : null;
        if (!quotes) {
          const settled = await Promise.allSettled(funds.map((f) => quote(f.symbol)));
          quotes = settled.flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []));
          if (quotes.length) cache.set(country, { at: Date.now(), quotes });
        }
        return Response.json(
          {
            asOf: new Date(cache.get(country)?.at ?? Date.now()).toISOString(),
            source: "Yahoo Finance",
            quotes,
          },
          { headers: { "Cache-Control": "public, max-age=3600" } },
        );
      },
    },
  },
});
