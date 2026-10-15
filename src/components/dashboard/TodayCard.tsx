import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarClock, Lightbulb, Wallet } from "lucide-react";
import {
  buildInsights,
  formatMoney,
  healthReport,
  safeToSpend,
  summarizeInsights,
  upcomingBills,
  type FinanceData,
} from "@/lib/finance";
import type { RecentTxn } from "@/lib/useGrowth";

const when = (days: number) => (days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

/** One glance: what you can spend today, the next bill, and the one thing to do. */
export function TodayCard({ data, txns }: { data: FinanceData; txns: RecentTxn[] }) {
  const cur = data.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);
  const { spend, bill, tip } = useMemo(() => {
    const spend = safeToSpend(data, txns);
    const bill = upcomingBills(data, txns)[0] ?? null;
    const step = summarizeInsights(buildInsights(data)).nextSteps[0];
    const tip = step ?? healthReport(data).focus?.tip ?? null;
    return { spend, bill, tip };
  }, [data, txns]);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="panel p-5" data-tour="today">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
        Today · {today}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
            <Wallet className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Safe to spend today</p>
            <p className="numeric text-xl font-semibold">
              {spend.safe > 0 ? m(spend.perDay) : m(0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {spend.safe > 0 ? `${m(spend.safe)} left this month` : "You're over for this month"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/12 text-warning">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Next bill</p>
            {bill ? (
              <>
                <p className="truncate text-base font-semibold">{bill.label}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="numeric">{m(bill.amount)}</span> · {when(bill.daysAway)}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Nothing due soon</p>
                <p className="text-xs text-muted-foreground">
                  <Link to="/spending" className="underline">
                    Import a statement
                  </Link>{" "}
                  to spot your bills
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Lightbulb className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">One thing to do</p>
            <p className="text-sm">{tip ?? "You're on track. Keep your numbers up to date."}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
