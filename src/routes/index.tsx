import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  Legend,
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
import {
  buildInsights,
  formatMoney,
  investmentGrowth,
  project,
  summarize,
  convert,
  getRates,
  type PotGrowth,
  type YearChange,
} from "@/lib/finance";
import { Slider } from "@/components/ui/slider";
import { Meaning, Num } from "@/components/kudi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KudiLens — your personal finance analyst" },
      {
        name: "description",
        content:
          "See your net worth, debt, investments and family costs in one place, with projections and data-driven advice.",
      },
      { property: "og:title", content: "KudiLens — your personal finance analyst" },
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
      pots: investmentGrowth(data, 25),
    };
  }, [data, extra]);

  if (isLoading) return <p className="text-muted-foreground">Crunching your numbers…</p>;
  if (error) return <p className="text-destructive">Could not load data: {error.message}</p>;
  if (!data || !computed) return null;

  const { s, base, boosted, insights, pots } = computed;
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
        convert(Number(i.current_value), i.currency, cur, getRates(data));
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
        <Stat
          label="Total debt"
          value={m(s.totalDebt)}
          sub={`avg ${s.weightedDebtRate.toFixed(1)}% APR`}
        />
        <Stat
          label="Invested"
          value={m(s.totalInvested)}
          sub={`exp. ${s.weightedReturn.toFixed(1)}%/yr`}
        />
        <Stat
          label="Monthly surplus"
          value={m(s.monthlySurplus)}
          tone={s.monthlySurplus >= 0 ? "good" : "bad"}
          sub={`savings rate ${s.savingsRate.toFixed(0)}%`}
        />
      </div>

      <section className="panel p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold">25-year net worth projection (expected case)</h2>
          <p className="text-xs text-muted-foreground">Tap or hover the chart to see any year</p>
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
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v: number) => formatMoney(v, cur, { compact: true })}
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
                labelFormatter={(l: string) => {
                  const [yr, age] = String(l).split(" · ");
                  return age ? `${yr} — you'll be ${age}` : yr;
                }}
                formatter={(v: number) => formatMoney(v, cur, { compact: true })}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {extra > 0 && (
                <Line
                  type="monotone"
                  dataKey="boosted"
                  name="With extra saving"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Net worth"
                stroke="var(--chart-1)"
                fill="url(#nw)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Real (today's money)"
                stroke="var(--chart-2)"
                strokeDasharray="5 5"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="debt"
                name="Debt"
                stroke="var(--chart-4)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <Meaning>
          The solid line is what you're likely to own minus what you owe each year, if your income,
          spending, debts and investments carry on as entered in My numbers. It's shown in future
          Naira, which buy less as prices rise — so the dashed line shows the same amount in{" "}
          <b>today's money</b> after {data.profile?.inflation_rate ?? 0}% yearly inflation. That
          dashed line is the one to judge your real progress by. Today you start at{" "}
          <Num formula="Accounts + investments + property − all debts, converted at today's exchange rates. This is the left-most point on the chart.">
            {m(s.netWorth)}
          </Num>
          .{" "}
          {base[10] && (
            <>
              In 10 years that's{" "}
              <Num formula="Expected path: each investment grows at exactly its expected return, income grows with salary growth, spending grows with inflation, debts are paid down at their minimum payments, and leftover money is kept as cash. Foreign-currency items are revalued as the Naira weakens. The Plan tab's 'likely' line sits a little lower because it includes market ups and downs.">
                {m(base[10].netWorth)}
              </Num>{" "}
              (about {m(base[10].realNetWorth)} in today's money).
            </>
          )}{" "}
          Debts with no monthly payment never shrink here. For the range from pessimistic to
          optimistic, see the Plan tab.
        </Meaning>

        {base[1]?.change && (
          <YearChangeBreakdown
            change={base[1].change}
            from={base[0]!.netWorth}
            to={base[1].netWorth}
            cur={cur}
          />
        )}

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
              <p className="numeric text-xs text-success">
                +{m(tenYearBoost.netWorth - tenYear.netWorth)}
              </p>
            )}
          </div>
        </div>
      </section>

      <InvestmentGrowth
        pots={pots}
        cur={cur}
        ages={base.map((p) => p.age)}
        startYear={base[0]!.year}
        deficit={s.monthlySurplus < 0}
      />

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

/** Explains a single year's jump in net worth, line by line. */
function YearChangeBreakdown({
  change,
  from,
  to,
  cur,
}: {
  change: YearChange;
  from: number;
  to: number;
  cur: string;
}) {
  const m = (n: number) => formatMoney(n, cur);
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${m(Math.abs(n))}`;
  const rows: { label: string; value: number; formula: string }[] = [
    {
      label: "Income left after living & family costs",
      value: change.leftover,
      formula:
        "12 months of income minus living and family costs. What you send to debts or investments still counts: it lowers what you owe or moves into your investments, so it's still yours.",
    },
    {
      label: "Investment returns",
      value: change.investmentReturns,
      formula: "Each investment's value × its expected return for the year.",
    },
    {
      label: "Property & other assets",
      value: change.assetGrowth,
      formula: "Each asset's value × its expected growth (negative for cars).",
    },
    {
      label: "Interest on cash",
      value: change.cashInterest,
      formula:
        "Cash in your accounts earns the share of inflation set in My numbers → assumptions (cash yield ratio).",
    },
    {
      label: "Interest on debts",
      value: change.debtInterest,
      formula: "Each debt's balance × its interest rate for the year.",
    },
    {
      label: "Exchange-rate effect",
      value: change.fxRevaluation,
      formula:
        "Foreign-currency investments, assets and debts repriced as the Naira moves by your expected depreciation rate.",
    },
  ].filter((r) => Math.abs(r.value) >= 1);
  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">
        Why it goes from {m(from)} to {m(to)} next year
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{r.label}</span>
            <span className={cn("numeric", r.value >= 0 ? "text-success" : "text-destructive")}>
              <Num formula={r.formula}>{signed(r.value)}</Num>
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 border-t border-border pt-1.5 font-medium">
          <span>Change in net worth</span>
          <span className="numeric">{signed(change.total)}</span>
        </li>
      </ul>
    </div>
  );
}

/** Each investment compounding at exactly the rate the user entered. */
function InvestmentGrowth({
  pots,
  cur,
  ages,
  startYear,
  deficit,
}: {
  pots: PotGrowth[];
  cur: string;
  ages: (number | null)[];
  startYear: number;
  deficit: boolean;
}) {
  if (pots.length === 0) return null;
  const m = (n: number) => formatMoney(n, cur);
  const short = (n: number) => formatMoney(n, cur, { compact: true });
  // biggest pots get their own band; the rest share an "Other" band
  const ranked = [...pots].sort((a, b) => (b.values.at(-1) ?? 0) - (a.values.at(-1) ?? 0));
  const shown =
    ranked.length > CHART_COLORS.length ? ranked.slice(0, CHART_COLORS.length - 1) : ranked;
  const rest = ranked.slice(shown.length);
  const years = pots[0]!.values.length;
  const chart = Array.from({ length: years }, (_, y) => {
    const row: Record<string, number | string> = {
      label: ages[y] != null ? `${startYear + y} · ${ages[y]}` : String(startYear + y),
    };
    for (const p of shown) row[p.id] = p.values[y]!;
    if (rest.length) row["other"] = rest.reduce((t, p) => t + p.values[y]!, 0);
    return row;
  });
  const at = (y: number) => pots.reduce((t, p) => t + (p.values[y] ?? 0), 0);
  const horizon = Math.min(10, years - 1);
  const last = years - 1;
  const contributed = pots.reduce((t, p) => t + p.contributed, 0);

  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold">Investment growth</h2>
        <p className="text-xs text-muted-foreground">
          At the rates you entered, today's exchange rates
        </p>
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              minTickGap={24}
            />
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
              labelFormatter={(l: string) => {
                const [yr, age] = String(l).split(" · ");
                return age ? `${yr} — you'll be ${age}` : yr;
              }}
              formatter={(v: number) => short(v)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {shown.map((p, i) => (
              <Area
                key={p.id}
                type="monotone"
                dataKey={p.id}
                name={p.name}
                stackId="pots"
                stroke={CHART_COLORS[i]}
                fill={CHART_COLORS[i]}
                fillOpacity={0.25}
              />
            ))}
            {rest.length > 0 && (
              <Area
                type="monotone"
                dataKey="other"
                name="Other"
                stackId="pots"
                stroke={CHART_COLORS[shown.length]}
                fill={CHART_COLORS[shown.length]}
                fillOpacity={0.25}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-normal">Investment</th>
              <th className="py-1.5 text-right font-normal">Today</th>
              <th className="py-1.5 text-right font-normal">Rate/yr</th>
              <th className="py-1.5 text-right font-normal">Adding/month</th>
              <th className="py-1.5 text-right font-normal">In {horizon} yrs</th>
              <th className="py-1.5 text-right font-normal">In {last} yrs</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-1.5">{p.name}</td>
                <td className="numeric py-1.5 text-right">{short(p.values[0]!)}</td>
                <td className="numeric py-1.5 text-right">{+p.ratePct.toFixed(2)}%</td>
                <td className="numeric py-1.5 text-right">{p.monthly ? short(p.monthly) : "—"}</td>
                <td className="py-1.5 text-right">
                  <Num formula={p.formula}>{short(p.values[horizon]!)}</Num>
                </td>
                <td className="py-1.5 text-right">
                  <Num formula={p.formula}>{short(p.values[last]!)}</Num>
                </td>
              </tr>
            ))}
            <tr className="border-t border-border font-medium">
              <td className="py-1.5">Total</td>
              <td className="numeric py-1.5 text-right">{short(at(0))}</td>
              <td />
              <td />
              <td className="numeric py-1.5 text-right">{short(at(horizon))}</td>
              <td className="numeric py-1.5 text-right">{short(at(last))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Meaning>
        Each investment grows by exactly the yearly rate you gave it, plus what you add each month.
        Over {last} years you'd put in {m(contributed)} and growth would add{" "}
        {m(Math.max(0, at(last) - at(0) - contributed))} on top. Tap any future value to see the
        sum. Foreign-currency investments are shown at today's exchange rate here; the net worth
        chart above also counts them gaining value as the Naira weakens.
        {deficit && (
          <>
            {" "}
            <b className="text-destructive">Heads up:</b> you're spending more each month than you
            earn, so the net worth projection sells investments to cover the gap. Those sales aren't
            shown here.
          </>
        )}
      </Meaning>
    </section>
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
