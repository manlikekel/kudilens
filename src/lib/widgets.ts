import { useEffect } from "react";
import { debtFreePlan, formatMoney, safeToSpend, summarize, type FinanceData } from "@/lib/finance";
import { usePrivacy } from "@/lib/privacy";
import type { RecentTxn } from "@/lib/useGrowth";

/** The "My money" widget's text, already formatted (and masked in privacy mode). */
export function moneyWidgetData(data: FinanceData, txns: RecentTxn[], now = new Date()) {
  const s = summarize(data);
  const cur = s.currency;
  const spend = safeToSpend(data, txns, now);
  const debt = debtFreePlan(data, now);
  const m = (n: number) => formatMoney(n, cur);
  return {
    safe: m(spend.safe),
    perDay:
      spend.safe > 0
        ? `About ${m(spend.perDay)} a day for ${spend.daysLeft} day${spend.daysLeft === 1 ? "" : "s"}`
        : "Over budget this month",
    netWorth: m(s.netWorth),
    debtFree:
      debt.totalDebt <= 0
        ? "Already debt-free"
        : debt.months == null
          ? "Not at current payments"
          : `${debt.months} months (${debt.debtFreeDate!.toLocaleDateString("en-GB", { month: "short", year: "numeric" })})`,
    updated: `Updated ${now.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
  };
}

/** Hands the latest summary to the service worker so the Windows widget can show it. */
export function useWidgetSync(data: FinanceData | undefined, txns: RecentTxn[]) {
  const [hidden] = usePrivacy();
  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
    if (!data || !sw) return;
    sw.postMessage({ type: "widget-data", data: moneyWidgetData(data, txns) });
  }, [data, txns, hidden]);
}
