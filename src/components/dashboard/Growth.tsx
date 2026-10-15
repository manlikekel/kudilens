import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Database } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  checkInCalendar,
  checkInSummary,
  formatMoney,
  snapshotOf,
  type FinanceData,
  type Snapshot,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

const monthLabel = (m: string) =>
  new Date(`${m}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

/** Shown while migration 0005 hasn't been applied to the database yet. */
export function NeedsDatabaseUpdate({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <Database className="mt-0.5 size-4 shrink-0 text-warning" />
      <p>
        <b>{feature}</b>: one-time database update needed. In Lovable, ask:{" "}
        <i>“Apply the migration drizzle/migrations/0005_growth_tools.sql”</i>. Everything else keeps
        working.
      </p>
    </div>
  );
}

/** Actual month-end net worth, recorded automatically. */
export function NetWorthHistory({ history, cur }: { history: Snapshot[]; cur: string }) {
  const points = history.filter((h) => h.currency === cur);
  if (!points.length) return null;
  const first = points[0]!;
  const last = points.at(-1)!;
  const change = Number(last.net_worth) - Number(first.net_worth);
  const short = (n: number) => formatMoney(n, cur, { compact: true });
  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold">Your real progress</h2>
        <p className="text-xs text-muted-foreground">
          Recorded each month from your actual numbers
        </p>
      </div>
      {points.length < 2 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Your history starts this month at{" "}
          <b className="text-foreground">{formatMoney(Number(last.net_worth), cur)}</b>. Come back
          next month to see how far you&apos;ve moved.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            <span
              className={cn(
                "numeric font-semibold",
                change >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {change >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(change), cur)}
            </span>{" "}
            <span className="text-muted-foreground">since {monthLabel(first.month)}</span>
          </p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points.map((p) => ({ ...p, label: monthLabel(p.month) }))}
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis
                  tickFormatter={short}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => short(v)}
                />
                <Line
                  type="monotone"
                  dataKey="net_worth"
                  name="Net worth"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot
                />
                <Line
                  type="monotone"
                  dataKey="debt"
                  name="Debt"
                  stroke="var(--chart-4)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}

const DONE_KEY = "kudi-checkin-done";

/** Once a month: update balances, then see what moved since last month. */
export function MonthlyCheckIn({ data, history }: { data: FinanceData; history: Snapshot[] }) {
  const current = snapshotOf(data);
  const [done, setDone] = useState(true);
  useEffect(() => {
    try {
      setDone(localStorage.getItem(DONE_KEY) === current.month);
    } catch {
      setDone(false);
    }
  }, [current.month]);
  const summary = checkInSummary(history, current);
  const cur = current.currency;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatMoney(Math.abs(n), cur)}`;
  if (done) return null;

  const addToCalendar = () => {
    const blob = new Blob([checkInCalendar(window.location.origin)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kudilens-monthly-check-in.ics";
    a.click();
    URL.revokeObjectURL(url);
  };
  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, current.month);
    } catch {
      /* ignore */
    }
    setDone(true);
  };

  return (
    <section className="panel border-primary/30 p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
        Monthly check-in
      </p>
      <h2 className="mt-1 text-lg font-semibold">
        {new Date().toLocaleDateString("en-GB", { month: "long" })}: update your balances
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Takes two minutes: bank balances, investment values and debts. Your history and forecasts
        update straight away.
      </p>
      {summary && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-4">
          {(
            [
              ["Net worth", summary.netWorth, true],
              ["Debt", summary.debt, false],
              ["Investments", summary.investments, true],
              ["Cash", summary.cash, true],
            ] as const
          ).map(([label, v, upIsGood]) => (
            <li key={label} className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">
                {label} since {monthLabel(summary.since)}
              </p>
              <p
                className={cn(
                  "numeric font-semibold",
                  Math.abs(v) < 1 ? "" : v > 0 === upIsGood ? "text-success" : "text-destructive",
                )}
              >
                {signed(v)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/check-in">Start the 2-minute check-in</Link>
        </Button>
        <Button variant="outline" onClick={finish}>
          <CheckCircle2 /> All up to date
        </Button>
        <Button variant="ghost" onClick={addToCalendar}>
          <CalendarPlus /> Monthly reminder
        </Button>
      </div>
    </section>
  );
}
