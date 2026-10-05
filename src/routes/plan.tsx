import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/lib/useFinance";
import {
  analyzeGoals, devaluationShock, educationForecast, emergencyFund, forecastCash, getAssumptions, goalCompetition,
  lifeEvents, monteCarlo, pickHorizons, protectionGaps, realReturns, recommendCurrencyMix, simulatePayoff, debtsAboveReturn,
  summarize, toNGN, type FinanceData, type Strategy, type View,
} from "@/lib/finance";
import { compact, Meaning, Num } from "@/components/kudi";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan — forecasts & what-ifs | KudiLens" },
      { name: "description", content: "Monte Carlo net worth forecast, goal odds, debt optimiser, cash flow, family costs and currency stress tests." },
      { property: "og:title", content: "Plan — forecasts & what-ifs | KudiLens" },
      { property: "og:description", content: "See where your money is heading and what to change." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <PlanPage />
    </AppShell>
  ),
});

const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 } };

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlanPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useFinance(user?.id);
  if (isLoading) return <p className="text-muted-foreground">Running the numbers…</p>;
  if (error) return <p className="text-destructive">Could not load data: {error.message}</p>;
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Plan</h1>
        <p className="text-sm text-muted-foreground">
          Forecasts built from your numbers and assumptions in “My numbers”. Tap any underlined figure to see the maths.
        </p>
      </div>
      <Forecast data={data} />
      <Goals data={data} />
      <Debts data={data} />
      <CashFlow data={data} />
      <Family data={data} />
      <Stress data={data} />
      <Protection data={data} />
    </div>
  );
}

/* 1. Net worth forecast */
function Forecast({ data }: { data: FinanceData }) {
  const [view, setView] = useState<View>("nominal");
  const p = data.profile;
  const years = p?.age && p.retirement_age && p.retirement_age > p.age ? Math.max(20, p.retirement_age - p.age) : 25;
  const mc = useMemo(() => monteCarlo(data, { years, sims: 1000 }), [data, years]);
  const cur = view === "usd" ? "USD" : "NGN";
  const chart = mc.points.map((pt) => {
    const [lo, mid, hi] = pt[view];
    return { year: pt.age ? `${pt.year} (age ${pt.age})` : String(pt.year), lo, band: hi - lo, mid };
  });
  const horizons = pickHorizons(data).filter((h) => h <= years);
  const target = p?.age && p.retirement_age ? Math.min(years, Math.max(1, Math.min(10, p.retirement_age - p.age))) : 10;
  const pt = mc.points[target]!;
  return (
    <Card title="Net worth forecast" sub={`${mc.sims.toLocaleString()} simulated futures`}>
      <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} variant="outline" size="sm">
        <ToggleGroupItem value="nominal">Naira</ToggleGroupItem>
        <ToggleGroupItem value="real">Today's Naira</ToggleGroupItem>
        <ToggleGroupItem value="usd">USD</ToggleGroupItem>
      </ToggleGroup>
      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <AreaChart data={chart}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" {...axis} minTickGap={30} />
            <YAxis tickFormatter={(v) => compact(v, cur)} width={64} {...axis} />
            <Tooltip {...tip} formatter={(v: number, n) => [compact(v, cur), n]} />
            <Area dataKey="lo" stackId="b" stroke="none" fill="transparent" name="Pessimistic (10%)" />
            <Area dataKey="band" stackId="b" stroke="none" fill="var(--primary)" fillOpacity={0.18} name="Range to optimistic (90%)" />
            <Line dataKey="mid" stroke="var(--primary)" strokeWidth={2} dot={false} name="Likely (50%)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {horizons.map((h) => {
          const x = mc.points[h]![view];
          return (
            <div key={h} className="rounded-lg bg-secondary/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground">In {h} yr{mc.points[h]!.age ? ` · age ${mc.points[h]!.age}` : ""}</p>
              <p className="numeric font-semibold">
                <Num formula={mc.formula}>{compact(x[1], cur)}</Num>
              </p>
              <p className="numeric text-xs text-muted-foreground">
                {compact(x[0], cur)} – {compact(x[2], cur)}
              </p>
            </div>
          );
        })}
      </div>
      <Meaning>
        In the likely case you'll have <b>{compact(pt.nominal[1])}</b> (≈<b>{compact(pt.usd[1], "USD")}</b>, or{" "}
        {compact(pt.real[1])} in today's money) {pt.age ? `by age ${pt.age}` : `in ${target} years`}. In a bad run it
        could be {compact(pt.nominal[0])}; in a good one {compact(pt.nominal[2])}. The shaded band is where 80% of
        simulated futures land.
      </Meaning>
    </Card>
  );
}

/* 2. Goal probability */
function Goals({ data }: { data: FinanceData }) {
  const analyses = useMemo(() => analyzeGoals(data), [data]);
  const comp = useMemo(() => goalCompetition(data, analyses), [data, analyses]);
  if (!analyses.length)
    return (
      <Card title="Goal probability">
        <p className="text-sm text-muted-foreground">Add goals in My numbers → Goals to see your odds of hitting them.</p>
      </Card>
    );
  return (
    <Card title="Goal probability" sub="Chance of reaching each goal on time at your current saving">
      <div className="space-y-3">
        {analyses.map((g) => {
          const pct = Math.round(g.probability * 100);
          return (
            <div key={g.goal.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {g.goal.name} <span className="text-xs text-muted-foreground">by {g.goal.target_year}</span>
                </p>
                <Badge variant={pct >= 75 ? "default" : pct >= 40 ? "secondary" : "destructive"}>
                  <Num formula={g.formula}>{pct}%</Num>
                </Badge>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Future cost {compact(g.targetNGN)} · Save per month for 50% / 75% / 90% odds:{" "}
                <span className="numeric text-foreground">
                  {compact(g.required.p50)} / {compact(g.required.p75)} / {compact(g.required.p90)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
      {comp.competing && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">These goals compete for the same money</p>
          <p className="text-muted-foreground">
            Reaching all of them at 75% odds needs about {compact(comp.needed)}/month extra, but you have{" "}
            {compact(comp.available)} free. Suggested order: {comp.order.map((g) => g.goal.name).join(" → ")}.
          </p>
        </div>
      )}
      <Meaning>
        A goal under 50% is more likely to be missed than hit. The monthly figures show what it takes to make it a safe bet.
        USD-priced goals get more expensive as the Naira weakens, so their targets grow over time.
      </Meaning>
    </Card>
  );
}

/* 3. Debt optimiser */
function Debts({ data }: { data: FinanceData }) {
  const a = getAssumptions(data);
  const s = summarize(data);
  const debts = data.debts.map((d) => ({
    id: d.id, name: d.name, balance: toNGN(d.balance, d.currency, a), rate: Number(d.interest_rate), minimum: toNGN(d.minimum_payment, d.currency, a),
  }));
  const [extra, setExtra] = useState(0);
  const [custom, setCustom] = useState<string[]>(() => debts.map((d) => d.id));
  const results = useMemo(
    () => (["avalanche", "snowball", "custom"] as Strategy[]).map((st) => simulatePayoff(debts, st, extra, custom)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, extra, custom],
  );
  const base = useMemo(() => simulatePayoff(debts, "avalanche", 0), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!debts.length)
    return (
      <Card title="Debt optimiser">
        <p className="text-sm text-muted-foreground">No debts recorded — nice.</p>
      </Card>
    );
  const worst = Math.max(...results.map((r) => r.totalInterest));
  const len = Math.max(...results.map((r) => r.timeline.length));
  const chart = Array.from({ length: len }, (_, m) => ({
    month: m,
    Avalanche: results[0]!.timeline[m]?.balance ?? 0,
    Snowball: results[1]!.timeline[m]?.balance ?? 0,
    Custom: results[2]!.timeline[m]?.balance ?? 0,
  }));
  const flagged = debtsAboveReturn(debts, s.weightedReturn * 100 || 0);
  const date = (m: number) => new Date(new Date().getFullYear(), new Date().getMonth() + m).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const move = (i: number, dir: -1 | 1) =>
    setCustom((c) => {
      const n = [...c];
      const j = i + dir;
      if (j < 0 || j >= n.length) return c;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <Card title="Debt optimiser" sub="Avalanche (highest rate first) vs Snowball (smallest balance first) vs your order">
      <div>
        <p className="text-sm">
          Extra payment per month: <span className="numeric font-semibold">{compact(extra)}</span>
        </p>
        <Slider className="mt-2 max-w-md" value={[extra]} max={Math.max(500_000, s.monthlyIncome * 0.5)} step={10_000} onValueChange={([v]) => setExtra(v)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {results.map((r) => (
          <div key={r.strategy} className="rounded-lg bg-secondary/50 p-3 text-sm">
            <p className="font-medium capitalize">{r.strategy}</p>
            <p className="text-muted-foreground">Debt-free: <span className="text-foreground">{r.finished ? date(r.months) : "50+ years"}</span></p>
            <p className="text-muted-foreground">
              Interest:{" "}
              <Num formula="Each month: balance × rate ÷ 12 is added; every debt gets its minimum; the extra plus minimums freed from cleared debts go to the first debt in this order.">
                {compact(r.totalInterest)}
              </Num>
            </p>
            <p className="text-muted-foreground">
              Saved vs no extra: <span className="text-primary">{compact(Math.max(0, base.totalInterest - r.totalInterest))}</span>
            </p>
            {r.totalInterest < worst && <p className="text-xs text-primary">Saves {compact(worst - r.totalInterest)} vs worst</p>}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="mb-1 text-xs text-muted-foreground">Your custom order</p>
        <ol className="space-y-1 text-sm">
          {custom.map((id, i) => {
            const d = debts.find((x) => x.id === id);
            if (!d) return null;
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="w-5 text-muted-foreground">{i + 1}.</span>
                <span className="flex-1">{d.name} · {d.rate}%</span>
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)}>↑</Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)}>↓</Button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-4 h-60">
        <ResponsiveContainer>
          <LineChart data={chart}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="month" {...axis} tickFormatter={(m) => `${m}m`} />
            <YAxis tickFormatter={(v) => compact(v)} width={60} {...axis} />
            <Tooltip {...tip} formatter={(v: number) => compact(v)} labelFormatter={(m) => date(Number(m))} />
            <Legend />
            <Line dataKey="Avalanche" stroke="var(--primary)" dot={false} />
            <Line dataKey="Snowball" stroke="var(--warning)" dot={false} />
            <Line dataKey="Custom" stroke="var(--muted-foreground)" dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {flagged.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {flagged.map((d) => (
            <p key={d.id}>
              <b>{d.name}</b> costs {d.rate}% a year, more than your investments earn (~{(s.weightedReturn * 100).toFixed(1)}%). Pay this off before investing more.
            </p>
          ))}
        </div>
      )}
      <Meaning>
        Avalanche usually costs the least interest; Snowball gives quicker wins by clearing small debts first. Move the slider to see how
        much faster you're free with extra payments.
      </Meaning>
    </Card>
  );
}

/* 4. Cash flow */
function CashFlow({ data }: { data: FinanceData }) {
  const f = useMemo(() => forecastCash(data), [data]);
  return (
    <Card title="12-month cash flow" sub="Including school fees, rent renewal and festive spending">
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={f.months}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axis} />
            <YAxis tickFormatter={(v) => compact(v)} width={60} {...axis} />
            <Tooltip {...tip} formatter={(v: number, n) => [compact(v), n === "net" ? "Net this month" : "Cash balance"]} />
            <Bar dataKey="net" radius={4}>
              {f.months.map((m) => (
                <Cell key={m.label} fill={m.net < 0 ? "var(--destructive)" : "var(--primary)"} />
              ))}
            </Bar>
            <Line dataKey="balance" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {f.months.filter((m) => m.lumps.length).map((m) => (
          <span key={m.label} className="rounded-full bg-secondary px-2 py-1">
            {m.label}: {m.lumps.map((l) => `${l.label} ${compact(l.amount)}`).join(", ")}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm">
        Set aside{" "}
        <Num formula={`${f.sinkingBreakdown.map((s) => `${s.label}: ${compact(s.monthly)}/mo`).join(" · ") || "No lump sums recorded."} — ${f.formula}`}>
          {compact(f.sinkingFund)}/month
        </Num>{" "}
        in a sinking fund to cover lump sums smoothly.
      </p>
      <Meaning>
        {f.negativeMonths > 0
          ? `${f.negativeMonths} month(s) will be tight (red bars) — spending is higher than income those months. Saving the sinking-fund amount every month evens them out.`
          : "Every month stays positive at your current numbers. Keep putting the sinking-fund amount aside so big bills never surprise you."}
      </Meaning>
    </Card>
  );
}

/* 5. Family & life stage */
function Family({ data }: { data: FinanceData }) {
  const edu = useMemo(() => educationForecast(data, 20), [data]);
  const a = getAssumptions(data);
  const debts = data.debts.map((d) => ({ id: d.id, name: d.name, balance: toNGN(d.balance, d.currency, a), rate: Number(d.interest_rate), minimum: toNGN(d.minimum_payment, d.currency, a) }));
  const events = useMemo(() => lifeEvents(data, simulatePayoff(debts, "avalanche").payoffOrder), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalLocal = edu.reduce((t, e) => t + e.local, 0);
  const totalAbroad = edu.reduce((t, e) => t + e.abroad, 0);
  const y0 = new Date().getFullYear();
  const span = Math.max(10, ...events.map((e) => e.year - y0));
  const colors: Record<string, string> = { school: "var(--primary)", debt: "var(--warning)", goal: "var(--chart-3, var(--primary))", retirement: "var(--foreground)", maturity: "var(--muted-foreground)" };
  return (
    <Card title="Family & life-stage planner" sub="School fees by stage with education inflation">
      {data.family.some((m) => m.relationship === "child") ? (
        <>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={edu}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="year" {...axis} />
                <YAxis tickFormatter={(v) => compact(v)} width={60} {...axis} />
                <Tooltip {...tip} formatter={(v: number, n) => [compact(v), n === "local" ? "All in Nigeria" : "University abroad"]} />
                <Bar dataKey="local" fill="var(--primary)" radius={3} />
                <Bar dataKey="abroad" fill="var(--warning)" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm">
            20-year education bill:{" "}
            <Num formula={`Yearly fees today — nursery ₦0.8m, primary ₦1.5m, secondary ₦2.5m, university ₦3m (or $25k abroad) — grown by ${(a.educationInflation * 100).toFixed(0)}%/yr. Abroad fees grow 4%/yr in USD and are converted at a Naira rate weakening ${(a.fxDepreciation * 100).toFixed(0)}%/yr.`}>
              {compact(totalLocal)}
            </Num>{" "}
            in Nigeria, or {compact(totalAbroad)} with university abroad.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Add children in My numbers → Family to forecast school fees.</p>
      )}
      <div className="relative mt-6 h-24 overflow-x-auto">
        <div className="absolute left-0 right-0 top-10 h-px bg-border" />
        {events.map((e, i) => (
          <div key={i} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${Math.min(97, Math.max(3, ((e.year - y0) / span) * 100))}%` }}>
            <p className="whitespace-nowrap text-[10px] text-muted-foreground" style={{ marginTop: i % 2 ? 52 : 0 }}>
              {e.year}<br />{e.label}
            </p>
            <span className="absolute left-1/2 top-[34px] size-3 -translate-x-1/2 rounded-full" style={{ background: colors[e.kind] }} />
          </div>
        ))}
      </div>
      <Meaning>
        School fees rise faster than general prices, so the same school costs much more each year. The timeline shows when big events
        land so you can start saving years before, not months before.
      </Meaning>
    </Card>
  );
}

/* 6. Inflation & currency stress */
function Stress({ data }: { data: FinanceData }) {
  const [shock, setShock] = useState(30);
  const rr = useMemo(() => realReturns(data), [data]);
  const r = useMemo(() => devaluationShock(data, shock / 100), [data, shock]);
  const mix = useMemo(() => recommendCurrencyMix(data), [data]);
  return (
    <Card title="Inflation & currency stress test">
      {rr.length > 0 && (
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={rr} layout="vertical">
              <XAxis type="number" {...axis} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={110} {...axis} />
              <Tooltip {...tip} formatter={(v: number) => `${v.toFixed(1)}% real / yr`} />
              <Bar dataKey="real" radius={3}>
                {rr.map((x) => (
                  <Cell key={x.name} fill={x.real < 0 ? "var(--destructive)" : "var(--primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-4">
        <p className="text-sm">What if the Naira loses another <b>{shock}%</b>?</p>
        <Slider className="mt-2 max-w-md" value={[shock]} min={10} max={60} step={5} onValueChange={([v]) => setShock(v)} />
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Net worth in Naira</p>
            <Num formula={r.formula}>{compact(r.before.ngn)} → {compact(r.after.ngn)}</Num>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Net worth in dollars</p>
            <Num formula={r.formula}>{compact(r.before.usd, "USD")} → {compact(r.after.usd, "USD")}</Num>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Extra Naira for dollar goals</p>
            <span className="numeric">{compact(r.usdGoalsCostIncrease)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border p-3 text-sm">
        <p>
          Suggested foreign-currency share: <b>{Math.round(mix.foreignShare * 100)}%</b> (you have {Math.round(mix.currentForeignShare * 100)}%).
        </p>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {mix.reasons.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>
      <Meaning>
        Red bars are losing buying power: inflation is eating them faster than they grow. Holding some dollars protects goals that
        will be paid in foreign currency if the Naira falls.
      </Meaning>
    </Card>
  );
}

/* 7. Emergency & protection */
function Protection({ data }: { data: FinanceData }) {
  const ef = emergencyFund(data);
  const gaps = protectionGaps(data);
  const pct = ef.target > 0 ? Math.min(100, (ef.current / ef.target) * 100) : 100;
  return (
    <Card title="Emergency fund & protection check">
      <p className="text-sm">
        Recommended emergency fund: <Num formula={ef.formula}>{compact(ef.target)}</Num> ({ef.months} months). You have {compact(ef.current)}.
      </p>
      <div className="mt-2 h-2 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {gaps.map((g) => (
          <div key={g.kind} className={`rounded-lg border p-3 text-sm ${g.gap > 0 ? "border-warning/50" : "border-border"}`}>
            <p className="font-medium capitalize">{g.kind} cover</p>
            <p className="text-muted-foreground">
              Need <Num formula={g.formula}>{compact(g.needed)}</Num> · have {compact(g.have)}
            </p>
            {g.gap > 0 ? <p className="text-warning">Gap of {compact(g.gap)}</p> : <p className="text-primary">Covered</p>}
          </div>
        ))}
      </div>
      <Meaning>
        The emergency fund keeps a job loss or hospital bill from turning into new debt. Cover gaps show what your family would be
        short if something happened to you — this is a check, not a product recommendation.
      </Meaning>
    </Card>
  );
}
