import { createFileRoute } from "@tanstack/react-router";
import { latestSecReport } from "@/lib/invest/sec.server";
import { marketAssumptions } from "@/lib/market.server";

/**
 * Data for the "Market today" Windows widget: flat, already-formatted strings that the Adaptive
 * Card template in /widgets/market-template.json binds to. Public data only.
 */
export const Route = createFileRoute("/api/widget-market")({
  server: {
    handlers: {
      GET: async () => {
        const [m, sec] = await Promise.all([
          marketAssumptions(),
          latestSecReport().catch(() => null),
        ]);
        const mmf = (sec?.funds ?? [])
          .filter((f) => /money market/i.test(f.category) && f.yieldYtd != null)
          .sort((a, b) => b.yieldYtd! - a.yieldYtd!);
        const pct = (x: number | undefined, dp = 1) => (x == null ? "—" : `${x.toFixed(dp)}%`);
        const move = m.fxChange1y?.value;
        return Response.json(
          {
            inflation: pct(m.inflation?.value, 2),
            inflationPeriod: m.inflation?.asOf ?? "",
            naira: m.ngnPerUsd ? `₦${Math.round(m.ngnPerUsd.value).toLocaleString("en-NG")}` : "—",
            nairaMove:
              move == null
                ? ""
                : `${move < 0 ? "stronger" : "weaker"} by ${Math.abs(move).toFixed(1)}% in a year`,
            topFund: mmf[0]?.name ?? "—",
            topYield: mmf[0] ? pct(mmf[0].yieldYtd! * 100) : "—",
            fundsWeek: sec?.weekEnded
              ? `SEC report, week ended ${sec.weekEnded.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}`
              : "",
            updated: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          },
          { headers: { "Cache-Control": "public, max-age=3600" } },
        );
      },
    },
  },
});
