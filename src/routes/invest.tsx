import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CountrySelect } from "@/components/CountrySelect";
import { Disclaimer, Meaning, Num } from "@/components/kudi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  allocation,
  currencyMix,
  formatMoney,
  independence,
  summarize,
  type FinanceData,
} from "@/lib/finance";
import {
  FUNDS,
  NG_FUND_REPORT_URL,
  NG_FUND_TYPES,
  PLATFORMS,
  type Country,
  type Fund,
  type FundRisk,
  type PlatformKind,
} from "@/lib/invest/directory";
import { useCountry } from "@/lib/invest/useCountry";
import type { NgFundReport } from "@/lib/invest/secnav";
import { useFinance } from "@/lib/useFinance";
import { cn } from "@/lib/utils";
import type { FundQuote } from "./api/funds";

export const Route = createFileRoute("/invest")({
  head: () => ({
    meta: [
      { title: "Invest — platforms, funds and wealth tools | KudiLens" },
      {
        name: "description",
        content:
          "Regulated investment platforms and fund performance for your country, plus tools to plan your wealth.",
      },
    ],
  }),
  component: InvestPage,
});

function InvestPage() {
  return (
    <AppShell>
      <Invest />
    </AppShell>
  );
}

function Invest() {
  const { user } = useAuth();
  const { data } = useFinance(user?.id);
  const { country } = useCountry();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Invest</h1>
          <p className="text-sm text-muted-foreground">
            Regulated places to invest, how popular funds have performed, and how your own money is
            set up.
          </p>
        </div>
        <CountrySelect />
      </div>

      <Tabs defaultValue="platforms">
        <TabsList className="no-scrollbar flex h-auto w-full justify-start overflow-x-auto rounded-xl p-1 sm:w-auto [&>*]:shrink-0">
          <TabsTrigger value="platforms">Where to invest</TabsTrigger>
          <TabsTrigger value="funds">Funds &amp; ETFs</TabsTrigger>
          <TabsTrigger value="tools">My wealth check</TabsTrigger>
        </TabsList>
        <TabsContent value="platforms" className="mt-5">
          <Platforms key={country.code} country={country} />
        </TabsContent>
        <TabsContent value="funds" className="mt-5">
          {country.code === "NG" ? (
            <NigeriaFunds />
          ) : (
            <Funds country={country} risk={data?.profile?.risk_tolerance} />
          )}
        </TabsContent>
        <TabsContent value="tools" className="mt-5">
          {data ? <WealthCheck data={data} country={country} /> : null}
        </TabsContent>
      </Tabs>
      <Disclaimer />
    </div>
  );
}

/* ---------------- platforms ---------------- */

const KINDS: PlatformKind[] = [
  "Investment app",
  "Fund manager",
  "Stockbroker",
  "Robo-advisor",
  "Savings bank",
];

function Platforms({ country }: { country: Country }) {
  const [kind, setKind] = useState<PlatformKind | "All">("All");
  const all = PLATFORMS[country.code];
  const list = all.some((p) => p.kind === kind) ? all.filter((p) => p.kind === kind) : all;
  return (
    <div className="space-y-5">
      <section className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-medium">
              Regulated in {country.name} by {country.regulators.map((r) => r.short).join(" and ")}
            </p>
            <p className="text-sm text-muted-foreground">
              Always confirm a firm on the regulator's own register before sending money. Not being
              listed here doesn't mean a firm is unregulated.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {country.regulators.map((r) => (
            <a
              key={r.registerUrl}
              href={r.registerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              {r.registerLabel} <ExternalLink className="size-3.5" />
            </a>
          ))}
        </div>
      </section>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(
          [
            "All",
            ...KINDS.filter((k) => PLATFORMS[country.code].some((p) => p.kind === k)),
          ] as const
        ).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "shrink-0 rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent",
              kind === k && "border-primary bg-primary/10 text-primary",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((p) => (
          <article key={p.name} className="panel flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{p.kind}</p>
              </div>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
              >
                Visit <ExternalLink className="size-3.5" />
              </a>
            </div>
            <p className="mt-3 text-sm">{p.offers}</p>
            <p className="mt-1 text-sm text-muted-foreground">Good for: {p.bestFor}</p>
            <p className="mt-auto pt-3 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1",
                  p.licence.includes("check")
                    ? "bg-warning/12 text-warning"
                    : "bg-success/12 text-success",
                )}
              >
                <ShieldCheck className="size-3.5" /> {p.licence}
              </span>
            </p>
          </article>
        ))}
      </div>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Tax-friendly accounts in {country.name}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {country.accounts.map((a) => (
            <li key={a.name} className="rounded-xl bg-secondary/50 p-3">
              <p className="text-sm font-medium">{a.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------------- funds ---------------- */

const RISK_RANK: Record<FundRisk, number> = { low: 0, medium: 1, high: 2 };
const TOLERANCE_MAX: Record<string, number> = { conservative: 0, balanced: 1, growth: 2 };
type SortKey = "r5y" | "r3y" | "r1y" | "ytd";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "r5y", label: "5 yr" },
  { key: "r3y", label: "3 yr" },
  { key: "r1y", label: "1 yr" },
  { key: "ytd", label: "This year" },
];

const pct = (x: number | null | undefined) =>
  x == null ? "—" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;

function RiskBadge({ risk }: { risk: FundRisk }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
        risk === "low" && "bg-success/12 text-success",
        risk === "medium" && "bg-warning/12 text-warning",
        risk === "high" && "bg-destructive/12 text-destructive",
      )}
    >
      {risk} risk
    </span>
  );
}

function Funds({ country, risk }: { country: Country; risk: string | undefined }) {
  const [sort, setSort] = useState<SortKey>("r5y");
  const [fitsOnly, setFitsOnly] = useState(false);
  const funds = FUNDS[country.code as keyof typeof FUNDS];
  const { data, isLoading, error } = useQuery({
    queryKey: ["funds", country.code],
    queryFn: async () => {
      const res = await fetch(`/api/funds?country=${country.code}`);
      if (!res.ok) throw new Error(`Couldn't load fund prices (${res.status})`);
      return (await res.json()) as { asOf: string | null; source: string; quotes: FundQuote[] };
    },
    staleTime: 3600_000,
  });
  const max = TOLERANCE_MAX[risk ?? "balanced"] ?? 1;
  const rows = useMemo(() => {
    const q = new Map((data?.quotes ?? []).map((x) => [x.symbol, x]));
    return funds
      .map((f) => ({ fund: f, quote: q.get(f.symbol), fits: RISK_RANK[f.risk] <= max }))
      .filter((r) => !fitsOnly || r.fits)
      .sort((a, b) => (b.quote?.[sort] ?? -Infinity) - (a.quote?.[sort] ?? -Infinity));
  }, [funds, data, sort, fitsOnly, max]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by</span>
          <div className="flex rounded-lg bg-secondary/60 p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm",
                  sort === s.key && "bg-primary text-primary-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fitsOnly}
            onChange={(e) => setFitsOnly(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          Only funds that fit my risk level ({risk ?? "balanced"})
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <div className="grid gap-3">
        {rows.map(({ fund, quote, fits }) => (
          <FundCard
            key={fund.symbol}
            fund={fund}
            quote={quote}
            fits={fits}
            loading={isLoading}
            sort={sort}
          />
        ))}
      </div>

      <Meaning>
        These are popular low-cost index funds, not personal recommendations. Returns include
        reinvested dividends; 3 and 5 year figures are yearly averages. Past performance doesn't
        guarantee future returns. Prices from {data?.source ?? "Yahoo Finance"}
        {data?.asOf
          ? `, updated ${new Date(data.asOf).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
          : ""}
        . Fees are approximate; check the fund's page.
      </Meaning>
    </div>
  );
}

function FundCard({
  fund,
  quote,
  fits,
  loading,
  sort,
}: {
  fund: Fund;
  quote: FundQuote | undefined;
  fits: boolean;
  loading: boolean;
  sort: SortKey;
}) {
  const cells: { key: SortKey; label: string }[] = [
    { key: "ytd", label: "This year" },
    { key: "r1y", label: "1 yr" },
    { key: "r3y", label: "3 yr / yr" },
    { key: "r5y", label: "5 yr / yr" },
  ];
  return (
    <article className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{fund.name}</h3>
            <Badge variant="secondary" className="numeric">
              {fund.symbol}
            </Badge>
            {fits && (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                Fits your risk level
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {fund.category} · {fund.what}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <RiskBadge risk={fund.risk} />
            <span>Fee ≈ {fund.fee}%/yr</span>
            {quote && (
              <span className="numeric">
                Price {formatMoney(quote.price, quote.currency, { compact: false })}
              </span>
            )}
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-4 gap-1 text-center sm:gap-2">
          {cells.map((c) => {
            const v = quote?.[c.key];
            return (
              <div
                key={c.key}
                className={cn(
                  "rounded-lg px-2 py-1.5 sm:min-w-[72px]",
                  sort === c.key && "bg-secondary/70",
                )}
              >
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </dt>
                <dd
                  className={cn(
                    "numeric text-sm font-semibold",
                    v != null && v >= 0 && "text-success",
                    v != null && v < 0 && "text-destructive",
                  )}
                >
                  {loading ? "…" : pct(v)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </article>
  );
}

function NigeriaFunds() {
  const [group, setGroup] = useState("All");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["ng-funds"],
    queryFn: async () => {
      const res = await fetch("/api/ng-funds");
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as NgFundReport & { source: string };
    },
    staleTime: 3600_000,
  });
  const groupOf = (category: string) => category.split(" · ")[0]!;
  const groups = useMemo(
    () => ["All", ...new Set((data?.funds ?? []).map((f) => groupOf(f.category)))],
    [data],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.funds ?? [])
      .filter((f) => group === "All" || groupOf(f.category) === group)
      .filter((f) => !q || `${f.name} ${f.manager}`.toLowerCase().includes(q))
      .sort((a, b) => (b.yieldYtd ?? -Infinity) - (a.yieldYtd ?? -Infinity));
  }, [data, group, query]);
  const visible = showAll ? rows : rows.slice(0, 25);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold">Nigerian mutual funds</h2>
          {data?.weekEnded && (
            <p className="text-xs text-muted-foreground">
              SEC weekly report, week ended{" "}
              {data.weekEnded.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Every SEC-registered fund, from the SEC&apos;s weekly valuation report. Money market funds
          show their current yearly yield; other funds show their return so far this year. Dollar
          funds are measured in dollars.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a fund or manager, e.g. Cowry, Stanbic"
            className="sm:max-w-xs"
          />
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent sm:text-sm",
                  group === g && "border-primary bg-primary/10 text-primary",
                )}
              >
                {g.replace(/ Funds?$/, "")}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">Loading the latest SEC report…</p>
        )}
        {error && (
          <p className="mt-4 text-sm text-destructive">
            Couldn&apos;t load the SEC report right now. {(error as Error).message}
          </p>
        )}

        {data && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-normal">Fund</th>
                  <th className="py-2 pr-3 font-normal">Type</th>
                  <th className="py-2 pr-3 text-right font-normal">Yield / return</th>
                  <th className="py-2 pr-3 text-right font-normal">This week</th>
                  <th className="py-2 pr-3 text-right font-normal">Unit price</th>
                  <th className="py-2 text-right font-normal">Investors</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((f) => {
                  const mm = /money market/i.test(f.category);
                  return (
                    <tr key={`${f.name}-${f.manager}`} className="border-t border-border/70">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.manager}</p>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{f.category}</td>
                      <td
                        className={cn(
                          "numeric py-2 pr-3 text-right font-semibold",
                          (f.yieldYtd ?? 0) >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {pct(f.yieldYtd)}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {mm ? "per year" : "this year"}
                        </span>
                      </td>
                      <td className="numeric py-2 pr-3 text-right text-muted-foreground">
                        {mm ? "—" : pct(f.yieldWtd)}
                      </td>
                      <td className="numeric py-2 pr-3 text-right">
                        {f.price != null
                          ? formatMoney(f.price, f.priceCurrency, { compact: false })
                          : "—"}
                      </td>
                      <td className="numeric py-2 text-right text-muted-foreground">
                        {f.unitholders?.toLocaleString() ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > visible.length && (
              <Button variant="outline" className="mt-3 w-full" onClick={() => setShowAll(true)}>
                Show all {rows.length} funds
              </Button>
            )}
            {rows.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No funds match.</p>
            )}
          </div>
        )}
        <a
          href={data?.source ?? NG_FUND_REPORT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open the SEC report <ExternalLink className="size-3.5" />
        </a>
      </section>

      <h3 className="pt-2 text-base font-semibold">Which type of fund is for what</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {NG_FUND_TYPES.map((t) => (
          <article key={t.name} className="panel p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{t.name}</h3>
              <RiskBadge risk={t.risk} />
            </div>
            <p className="mt-2 text-sm">{t.what}</p>
            <p className="mt-2 text-sm text-muted-foreground">Good for: {t.goodFor}</p>
          </article>
        ))}
      </div>
      <Meaning>
        Yields are what each fund reported to the SEC; past returns don&apos;t guarantee future
        ones. Already invested in a fund? Add it under{" "}
        <Link to="/records" className="text-primary underline">
          My numbers → Investments
        </Link>{" "}
        with its current yield as the expected return, and every forecast will use it.
      </Meaning>
    </div>
  );
}

/* ---------------- wealth check ---------------- */

function WealthCheck({ data, country }: { data: FinanceData; country: Country }) {
  const s = summarize(data);
  const cur = s.currency;
  const m = (n: number) => formatMoney(n, cur);
  const fi = independence(data);
  const alloc = allocation(data);
  const mix = currencyMix(data, country.currency);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Financial independence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When your investments alone could pay for your current lifestyle, every year.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">You need</p>
            <p className="numeric text-2xl font-semibold">
              <Num formula={fi.formula}>{m(fi.target)}</Num>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">You have invested</p>
            <p className="numeric text-2xl font-semibold">{m(fi.invested)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On track for</p>
            <p className="numeric text-2xl font-semibold text-primary">
              {fi.yearsToGoal == null
                ? "Not within 60 yrs"
                : fi.yearsToGoal === 0
                  ? "Reached"
                  : `${fi.yearsToGoal} yrs${fi.ageAtGoal ? ` · age ${fi.ageAtGoal}` : ""}`}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(2, fi.progress * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {(fi.progress * 100).toFixed(1)}% of the way there
        </p>
        <Meaning>
          Based on {m(fi.annualSpend)} a year of living and family costs, investments growing{" "}
          {(fi.realReturn * 100).toFixed(1)}% a year after inflation, and {m(fi.yearlyAdded)} a year
          added.{" "}
          {fi.realReturn <= 0 &&
            "Your expected returns don't beat inflation, so your money shrinks in real terms. Look at higher-yield or dollar funds."}
        </Meaning>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">
          Your mix vs a {data.profile?.risk_tolerance ?? "balanced"} target
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you own, grouped by type. The marker shows a simple target for your risk level
          and age.
        </p>
        <ul className="mt-4 space-y-3">
          {alloc.rows.map((r) => (
            <li key={r.bucket}>
              <div className="flex items-center justify-between text-sm">
                <span>{r.bucket}</span>
                <span className="numeric text-muted-foreground">
                  {(r.share * 100).toFixed(0)}%
                  {r.target != null && ` · target ${(r.target * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-chart-2"
                  style={{ width: `${r.share * 100}%` }}
                />
                {r.target != null && (
                  <span
                    className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground"
                    style={{ left: `calc(${r.target * 100}% - 1px)` }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
        <Meaning>
          Target: {(alloc.stockTarget * 100).toFixed(0)}% of your investable money in stocks, 10% in
          cash, the rest in bonds. It eases toward safer assets after 40. Property and crypto aren't
          given a target. Change your risk level in{" "}
          <Link to="/records" className="text-primary underline">
            My numbers → Profile
          </Link>
          .
        </Meaning>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Currency protection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(mix.foreignShare * 100).toFixed(0)}% of what you own is held outside {mix.home}.
        </p>
        <ul className="mt-4 space-y-3">
          {mix.rows.map((r) => (
            <li key={r.currency}>
              <div className="flex items-center justify-between text-sm">
                <span>{r.currency}</span>
                <span className="numeric text-muted-foreground">
                  {m(r.value)} · {(r.share * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full",
                    r.currency === mix.home ? "bg-chart-1" : "bg-chart-3",
                  )}
                  style={{ width: `${r.share * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {country.code === "NG" && (
          <Meaning>
            Holding part of your wealth in dollars (dollar funds, Eurobonds, US ETFs) protects it
            when the Naira weakens. Many Nigerian planners suggest 20–40% for long-term money;
            what's right for you depends on your goals, especially any abroad.
          </Meaning>
        )}
      </section>
    </div>
  );
}
