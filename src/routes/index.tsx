import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/lib/useFinance";
import { buildInsights, formatMoney, project, summarize, convert } from "@/lib/finance";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LedgerIQ — your personal finance analyst" },
      {
        name: "description",
        content:
          "See your net worth, debt, investments and family costs in one place, with projections and data-driven advice.",
      },
      { property: "og:title", content: "LedgerIQ — your personal finance analyst" },
      {
        property: "og:description",
        content: "Projections, insights and AI advice built from your own money data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useFinance(user?.id);
  const [extra, setExtra] = useState(0);

  const computed = useMemo(() => {
    if (!data) return null;
    const s = summarize(data);
    return {
      s,
      base: project(data, 25),
      boosted: project(data, 25, extra),
      insights: buildInsights(data),
    };
  }, [data, extra]);

  if (isLoading) return <p className="text-muted-foreground">Crunching your numbers…</p>;
  if (error) return <p className="text-destructive">Could not load data: {error.message}</p>;
  if (!data || !computed) return null;

  const { s, base, boosted, insights } = computed;
  const cur = s.currency;
  const m = (n: number) => formatMoney(n, cur);
  const empty =
    data.debts.length + data.investments.length + data.flows.length + data.family.length === 0;

  const chart = base.map((p, i) => ({
    label: p.age !== null ? `${p.year} · ${p.age}` : String(p.year),
    netWorth: p.netWorth,
    real: p.realNetWorth,
    boosted: boosted[i]?.netWorth ?? p.netWorth,
    debt: p.debt,
  }));

  const allocation = Object.entries(
    data.investments.reduce<Record<string, number>>((acc, i) => {
      acc[i.asset_class] =
        (acc[i.asset_class] ?? 0) +
        convert(Number(i.current_value), i.currency, cur, data.profile?.usd_ngn_rate ?? 1500);
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const spend = [
    { name: "Living costs", value: s.monthlyExpenses },
    { name: "Family", value: s.familyCost },
    { name: "Debt payments", value: s.minimumDebtPayments },
    { name: "Investing", value: s.monthlyContributions },
    { name: "Unallocated", value: Math.max(s.monthlySurplus, 0) },
  ].filter((x) => x.value > 0);

  const tenYear = base[10];
  const tenYearBoost = boosted[10];
  const maxExtra = Math.max(Math.round(s.monthlyIncome * 0.5), cur === "USD" ? 2000 : 1_000_000);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {data.profile?.full_name ? `Hi ${data.profile.full_name}` : "Welcome"} · shown in {cur}
          </p>
          <h1 className="text-3xl font-semibold">Your financial picture</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/records">Update my numbers</Link>
        </Button>
      </div>

      {empty && (
        <div className="panel flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Start by adding your numbers</h2>
            <p className="text-sm text-muted-foreground">
              Add your age, family, income, spending, debts and investments — the analysis fills in
              automatically.
            </p>
          </div>
          <Button asChild>
            <Link to="/records">Add my numbers</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net worth" value={m(s.netWorth)} tone={s.netWorth >= 0 ? "good" : "bad"} />
        <Stat label="Total debt" value={m(s.totalDebt)} sub={`avg ${s.weightedDebtRate.toFixed(1)}% APR`} />
        <Stat label="Invested" value={m(s.totalInvested)} sub={`exp. ${s.weightedReturn.toFixed(1)}%/yr`} />
        <Stat
          label="Monthly surplus"
          value={m(s.monthlySurplus)}
          tone={s.monthlySurplus >= 0 ? "good" : "bad"}
          sub={`savings rate ${s.savingsRate.toFixed(0)}%`}
        />
      </div>

      <section className="panel p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold">25-year net worth projection</h2>
          <p className="text-xs text-muted-foreground">
            Dashed = today's money after {data.profile?.inflation_rate ?? 0}% inflation
          </p>
        </div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ left: 8, right: 8 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={24} />
              <YAxis
                tickFormatter={(v: number) => formatMoney(v, cur)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                width={70}
              />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: number) => formatMoney(v, cur)}
              />
              {extra > 0 && (
                <Line type="monotone" dataKey="boosted" name="With extra saving" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
              )}
              <Area type="monotone" dataKey="netWorth" name="Net worth" stroke="var(--chart-1)" fill="url(#nw)" strokeWidth={2} />
              <Line type="monotone" dataKey="real" name="Real (today's money)" stroke="var(--chart-2)" strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="debt" name="Debt" stroke="var(--chart-4)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium">What if I saved an extra {m(extra)} every month?</p>
            <Slider
              className="mt-3"
              value={[extra]}
              max={maxExtra}
              step={Math.max(Math.round(maxExtra / 100), 1)}
              onValueChange={(v) => setExtra(v[0] ?? 0)}
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">In 10 years</p>
            <p className="numeric text-2xl font-semibold text-warning">
              {tenYearBoost ? m(tenYearBoost.netWorth) : "—"}
            </p>
            {tenYear && tenYearBoost && extra > 0 && (
              <p className="numeric text-xs text-success">+{m(tenYearBoost.netWorth - tenYear.netWorth)}</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">What the data says</h2>
          <Button asChild size="sm" variant="ghost">
            <Link to="/advisor">Ask the advisor →</Link>
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {insights.length === 0 && (
            <p className="text-sm text-muted-foreground">Add more data to unlock insights.</p>
          )}
          {insights.map((ins) => (
            <article
              key={ins.id}
              className={cn(
                "panel border-l-4 p-4",
                ins.severity === "critical" && "border-l-destructive",
                ins.severity === "watch" && "border-l-warning",
                ins.severity === "good" && "border-l-success",
              )}
            >
              <div className="flex items-start gap-2">
                {ins.severity === "critical" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : ins.severity === "watch" ? (
                  <Eye className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                )}
                <div className="min-w-0">
                  <h3 className="font-medium">{ins.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{ins.detail}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-primary">Do this: </span>
                    {ins.action}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Donut title="Where each month's income goes" data={spend} cur={cur} />
        <Donut title="Investment mix" data={allocation} cur={cur} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "numeric mt-2 text-2xl font-semibold",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Donut({
  title,
  data,
  cur,
}: {
  title: string;
  data: { name: string; value: number }[];
  cur: string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="mt-2 grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={42} outerRadius={64} stroke="none">
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate capitalize">{d.name}</span>
                </span>
                <span className="numeric text-muted-foreground">
                  {formatMoney(d.value, cur)} · {((d.value / total) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
