import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { NeedsDatabaseUpdate } from "@/components/dashboard/Growth";
import { Meaning } from "@/components/kudi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SPEND_CATEGORIES,
  formatMoney,
  monthSpend,
  monthlySpending,
  sinkingFunds,
  type FinanceData,
  type Txn,
} from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useBudgets, useSaveBudget } from "@/lib/useGrowth";
import { cn } from "@/lib/utils";

type Row = Pick<Txn, "txn_date" | "amount_minor" | "category" | "currency" | "merchant">;

/** Monthly limits per spending category, against what's actually been spent this month. */
export function Budgets({ data, txns, uid }: { data: FinanceData; txns: Row[]; uid: string }) {
  const budgets = useBudgets(uid);
  const save = useSaveBudget(uid);
  const cur = data.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);
  const spent = useMemo(() => monthSpend(data, txns), [data, txns]);
  const [adding, setAdding] = useState("");

  if (budgets.missing) return <NeedsDatabaseUpdate feature="Monthly budgets" />;
  const list = budgets.data ?? [];
  const limits = new Map(list.map((b) => [b.category, Number(b.monthly_limit)]));

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const pace = today.getDate() / daysInMonth;
  const totalLimit = list.reduce((t, b) => t + Number(b.monthly_limit), 0);
  const totalSpent = list.reduce((t, b) => t + (spent.byCategory[b.category] ?? 0), 0);
  const unbudgeted = SPEND_CATEGORIES.filter((c) => !limits.has(c));

  const setLimit = (category: string, monthly_limit: number) =>
    save.mutate(
      { category, monthly_limit, currency: cur },
      { onError: (e) => toast.error(e.message) },
    );

  /** Budget = average of the last three full months, rounded up to the nearest 5,000. */
  const suggest = () => {
    const months = monthlySpending(txns.filter((t) => t.currency === "NGN"));
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const full = months.filter((x) => x.month < current).slice(-3);
    if (!full.length) {
      toast.error("Import at least one full month of statements first.");
      return;
    }
    let added = 0;
    for (const c of SPEND_CATEGORIES) {
      if (limits.has(c)) continue;
      const avg = full.reduce((t, x) => t + (x.byCategory[c] ?? 0), 0) / full.length / 100;
      if (avg >= 1000) {
        setLimit(c, Math.ceil(avg / 5000) * 5000);
        added++;
      }
    }
    toast.success(
      added
        ? `Added ${added} budgets from your last ${full.length} month(s).`
        : "Nothing new to add.",
    );
  };

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">This month&apos;s budgets</h2>
            <p className="text-sm text-muted-foreground">
              {list.length
                ? `${m(totalSpent)} of ${m(totalLimit)} spent · ${Math.round(pace * 100)}% of the month gone`
                : "Set a monthly limit for the categories you want to watch."}
            </p>
          </div>
          <Button variant="outline" onClick={suggest} disabled={save.isPending}>
            <Sparkles /> Suggest from my spending
          </Button>
        </div>

        <ul className="mt-5 space-y-4">
          {list.map((b) => {
            const used = spent.byCategory[b.category] ?? 0;
            const limit = Number(b.monthly_limit);
            const share = limit > 0 ? used / limit : 0;
            const ahead = share > pace + 0.1;
            return (
              <li key={b.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{b.category}</span>
                  <span className="numeric text-muted-foreground">
                    {m(used)} /{" "}
                    <BudgetInput value={limit} onSave={(v) => setLimit(b.category, v)} />
                  </span>
                </div>
                <div className="relative mt-1.5 h-2.5 rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      share > 1 ? "bg-destructive" : ahead ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${Math.min(100, share * 100)}%` }}
                  />
                  <span
                    className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/60"
                    style={{ left: `${pace * 100}%` }}
                    title="Where you'd be if you spent evenly through the month"
                  />
                </div>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    share > 1 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {share > 1
                    ? `${m(used - limit)} over`
                    : `${m(limit - used)} left${ahead ? " · spending faster than the month" : ""}`}
                </p>
              </li>
            );
          })}
        </ul>

        {unbudgeted.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <select
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className="h-11 rounded-xl border border-input bg-background/60 px-3 text-sm"
              aria-label="Category to budget"
            >
              <option value="">Add a budget for…</option>
              {unbudgeted.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {spent.byCategory[c] ? ` (${m(spent.byCategory[c]!)} so far)` : ""}
                </option>
              ))}
            </select>
            {adding && (
              <BudgetInput
                value={0}
                autoFocus
                onSave={(v) => (setLimit(adding, v), setAdding(""))}
              />
            )}
          </div>
        )}
      </section>
      {!spent.hasData && (
        <Meaning>
          No transactions for this month yet, so spending shows as zero.{" "}
          <span className="text-foreground">Import this month&apos;s statement</span> in the Import
          tab to track your budgets live.
        </Meaning>
      )}
    </div>
  );
}

function BudgetInput({
  value,
  onSave,
  autoFocus,
}: {
  value: number;
  onSave: (v: number) => void;
  autoFocus?: boolean;
}) {
  const [v, setV] = useState(value ? String(value) : "");
  const commit = () => {
    const n = Number(v);
    if (Number.isFinite(n) && n !== value) onSave(Math.max(0, n));
  };
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={v}
      autoFocus={autoFocus}
      placeholder="Limit"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="numeric inline-flex h-8 w-28 px-2 text-right text-sm sm:h-8"
      aria-label="Monthly limit"
    />
  );
}

/** Money set aside each month for yearly lump costs, and progress towards the next payment. */
export function SinkingFunds({ data, uid }: { data: FinanceData; uid: string }) {
  const qc = useQueryClient();
  const funds = useMemo(() => sinkingFunds(data), [data]);
  const cur = data.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);
  const [missing, setMissing] = useState(false);
  const total = funds.reduce((t, f) => t + f.monthly, 0);

  const saveSaved = async (id: string, saved: number) => {
    const { error } = await supabase.from("lump_costs").update({ saved }).eq("id", id);
    if (error) {
      if (/saved|column|schema cache/i.test(error.message)) setMissing(true);
      else toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["finance", uid] });
  };

  return (
    <div className="space-y-4">
      {missing && <NeedsDatabaseUpdate feature="Tracking money set aside" />}
      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Sinking funds</h2>
        <p className="text-sm text-muted-foreground">
          Put a little aside every month for big yearly costs, so they never wreck one month&apos;s
          budget.
          {funds.length > 0 && (
            <>
              {" "}
              Set aside <b className="text-foreground">{m(total)}</b> a month in total.
            </>
          )}
        </p>
        {funds.length === 0 ? (
          <p className="mt-4 text-sm">
            Add yearly costs like school fees, rent or insurance in{" "}
            <Link to="/records" className="text-primary underline">
              My numbers → Yearly costs
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-5 space-y-5">
            {funds.map((f) => {
              const share = f.amount > 0 ? Math.min(1, f.saved / f.amount) : 0;
              return (
                <li key={f.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {m(f.amount)} due{" "}
                      {f.nextDue.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-chart-2"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Saved <BudgetInput value={f.saved} onSave={(v) => void saveSaved(f.id, v)} />{" "}
                      · put aside <b className="text-foreground">{m(f.neededPerMonth)}</b>/month for
                      the next {f.monthsUntil} month{f.monthsUntil === 1 ? "" : "s"}
                    </span>
                    <span>{m(f.monthly)}/month keeps the whole year covered</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Meaning>
        These set-asides come off your safe-to-spend number on the dashboard, so the money is
        already spoken for when the bill arrives. Keep it in a money market fund or high-interest
        savings until it&apos;s due.
      </Meaning>
    </div>
  );
}
