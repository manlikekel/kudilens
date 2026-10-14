import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Download } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  analyzeGoals,
  buildInsights,
  checkInSummary,
  debtFreePlan,
  formatMoney,
  getAssumptions,
  project,
  safeToSpend,
  snapshotOf,
  summarize,
  type FinanceData,
  type Snapshot,
} from "@/lib/finance";
import { useFinance } from "@/lib/useFinance";
import { useRecentTxns, useSnapshots, type RecentTxn } from "@/lib/useGrowth";

export const Route = createFileRoute("/report")({
  head: () => ({ meta: [{ title: "Monthly report — KudiLens" }] }),
  component: ReportPage,
});

function ReportPage() {
  return (
    <AppShell>
      <Report />
    </AppShell>
  );
}

function Report() {
  const { user } = useAuth();
  const { data } = useFinance(user?.id);
  const snapshots = useSnapshots(user?.id);
  const txns = useRecentTxns(user?.id);
  if (!data) return <p className="text-muted-foreground">Preparing your report…</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-semibold">Monthly report</h1>
          <p className="text-sm text-muted-foreground">
            A one-page summary to keep or share. Choose “Save as PDF” in the print window.
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Download /> Download PDF
        </Button>
      </div>
      <ReportSheet
        data={data}
        email={user?.email ?? ""}
        history={snapshots.data ?? []}
        txns={txns.data ?? []}
      />
    </div>
  );
}

function ReportSheet({
  data,
  email,
  history,
  txns,
}: {
  data: FinanceData;
  email: string;
  history: Snapshot[];
  txns: RecentTxn[];
}) {
  const s = summarize(data);
  const cur = s.currency;
  const m = (n: number) => formatMoney(n, cur);
  const short = (n: number) => formatMoney(n, cur, { compact: true });
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${m(Math.abs(n))}`;
  const a = getAssumptions(data);
  const proj = useMemo(() => project(data, 25, 0, { protectInvestments: true }), [data]);
  const debt = useMemo(() => debtFreePlan(data), [data]);
  const goals = useMemo(() => analyzeGoals(data), [data]);
  const insights = useMemo(() => buildInsights(data).slice(0, 4), [data]);
  const spend = useMemo(() => safeToSpend(data, txns), [data, txns]);
  const change = checkInSummary(history, snapshotOf(data));
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <article className="report panel mx-auto max-w-[210mm] space-y-6 bg-card p-6 sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
            KudiLens monthly report
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{month}</h2>
          <p className="text-sm text-muted-foreground">
            {data.profile?.full_name ?? email} · figures in {cur}
          </p>
        </div>
        <img src="/icons/icon.svg" alt="" className="size-10 rounded-xl" />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Net worth", m(s.netWorth), change ? `${signed(change.netWorth)} vs last month` : ""],
            ["Invested", m(s.totalInvested), `expected ${s.weightedReturn.toFixed(1)}%/yr`],
            ["Debt", m(s.totalDebt), change ? `${signed(change.debt)} vs last month` : ""],
            [
              "Safe to spend",
              m(spend.safe),
              `this month · ${spend.mode === "live" ? "actual" : "planned"}`,
            ],
          ] as const
        ).map(([label, value, sub]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="numeric mt-1 text-lg font-semibold">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-base font-semibold">Where you&apos;re heading</h3>
        <p className="text-sm text-muted-foreground">
          Expected net worth: {short(proj[5]?.netWorth ?? 0)} in 5 years,{" "}
          {short(proj[10]?.netWorth ?? 0)} in 10, {short(proj[25]?.netWorth ?? 0)} in 25 (
          {short(proj[10]?.realNetWorth ?? 0)} in 10 years in today&apos;s money).
        </p>
        <div className="mt-2 overflow-hidden">
          <AreaChart
            width={680}
            height={180}
            data={proj.map((p) => ({ year: p.year, v: p.netWorth }))}
            className="max-w-full"
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              minTickGap={30}
            />
            <YAxis
              tickFormatter={short}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              width={56}
            />
            <Area
              dataKey="v"
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          </AreaChart>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-base font-semibold">Debts</h3>
          {debt.totalDebt <= 0 ? (
            <p className="text-sm text-muted-foreground">No debts. Well done.</p>
          ) : debt.months == null ? (
            <p className="text-sm text-destructive">
              At current payments some debts never get paid off.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Debt-free in <b>{debt.months} months</b> (
                {debt.debtFreeDate!.toLocaleDateString("en-GB", {
                  month: "short",
                  year: "numeric",
                })}
                ) paying {m(debt.monthlyPayment)} a month.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {debt.milestones.map((ms) => (
                  <li key={ms.id} className="flex justify-between gap-2">
                    <span>{ms.name}</span>
                    <span>
                      {ms.date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h3 className="text-base font-semibold">This month&apos;s money</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {(
              [
                ["Income", spend.income],
                ["Debt payments", -spend.debtPayments],
                ["Investing", -spend.investing],
                ["Set aside for yearly costs", -spend.sinking],
                [spend.mode === "live" ? "Spent so far" : "Planned spending", -spend.spending],
                ["Bills still to come", -spend.upcomingBills],
              ] as const
            ).map(([label, v]) => (
              <li key={label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="numeric">
                  {Math.abs(v) < 1 ? m(0) : v > 0 ? m(v) : `−${m(-v)}`}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-2 border-t border-border pt-1 font-medium">
              <span>Safe to spend</span>
              <span className="numeric">{m(spend.safe)}</span>
            </li>
          </ul>
        </section>
      </div>

      {goals.length > 0 && (
        <section>
          <h3 className="text-base font-semibold">Goals</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {goals.map((g) => (
              <li key={g.goal.id} className="flex justify-between gap-2">
                <span>
                  {g.goal.name}{" "}
                  <span className="text-muted-foreground">by {g.goal.target_year}</span>
                </span>
                <span className="numeric">{Math.round(g.probability * 100)}% likely</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights.length > 0 && (
        <section>
          <h3 className="text-base font-semibold">What to focus on</h3>
          <ul className="mt-1 space-y-2 text-sm">
            {insights.map((i) => (
              <li key={i.id}>
                <b>{i.title}.</b> <span className="text-muted-foreground">{i.action}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Assumptions: inflation {pct(a.inflation)}, Naira loss vs $ {pct(a.fxDepreciation)}/yr,
        salary growth {pct(a.salaryGrowth)}/yr
        {data.market ? " (live data from CBN, World Bank, US BLS and SEC Nigeria)" : ""}. Forecasts
        are estimates, not guarantees. KudiLens gives educational information, not licensed
        financial advice. Generated {new Date().toLocaleDateString("en-GB")}.
      </footer>
    </article>
  );
}
