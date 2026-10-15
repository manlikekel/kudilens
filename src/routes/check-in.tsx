import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  checkInSummary,
  formatMoney,
  monthSpend,
  snapshotOf,
  upcomingBills,
  type FinanceData,
} from "@/lib/finance";
import { useFinance } from "@/lib/useFinance";
import { useBudgets, useRecentTxns, useSnapshots, type RecentTxn } from "@/lib/useGrowth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/check-in")({
  head: () => ({ meta: [{ title: "Monthly check-in — KudiLens" }] }),
  component: CheckInPage,
});

function CheckInPage() {
  return (
    <AppShell>
      <CheckIn />
    </AppShell>
  );
}

/** same key the dashboard check-in card reads */
const CHECKIN_DONE_KEY = "kudi-checkin-done";
const STEPS = ["Last month", "Bank balances", "Debts", "Investments", "Bills", "Done"] as const;
type Table = "accounts" | "debts" | "investments";

function CheckIn() {
  const { user } = useAuth();
  const { data } = useFinance(user?.id);
  const txns = useRecentTxns(user?.id).data ?? [];
  const history = useSnapshots(user?.id).data ?? [];
  const budgets = useBudgets(user?.id).data ?? [];
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  if (!data) return <p className="text-muted-foreground">Loading your numbers…</p>;
  const cur = data.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);

  /** Save any balances typed on the current step, then move on. */
  async function saveAndNext(table: Table | null) {
    if (table) {
      const field = table === "investments" ? "current_value" : "balance";
      const changed = Object.entries(edits).filter(([k]) => k.startsWith(`${table}:`));
      if (changed.length) {
        setSaving(true);
        for (const [k, v] of changed) {
          const id = k.split(":")[1]!;
          const n = Number(v.replace(/,/g, ""));
          if (!Number.isFinite(n) || n < 0) continue;
          const { error } = await supabase
            .from(table)
            .update({ [field]: n } as never)
            .eq("id", id);
          if (error) {
            setSaving(false);
            toast.error(error.message);
            return;
          }
        }
        await qc.invalidateQueries({ queryKey: ["finance", user?.id] });
        setSaving(false);
        toast.success("Saved");
      }
    }
    setStep((s) => s + 1);
  }

  const finish = () => {
    try {
      localStorage.setItem(CHECKIN_DONE_KEY, snapshotOf(data).month);
    } catch {
      /* ignore */
    }
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
          Monthly check-in · {new Date().toLocaleDateString("en-GB", { month: "long" })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{STEPS[step]}</h1>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn("h-1.5 flex-1 rounded-full bg-secondary", i <= step && "bg-primary")}
            />
          ))}
        </div>
      </div>

      <section className="panel p-5">
        {step === 0 && <LastMonth data={data} txns={txns} budgets={budgets} m={m} />}
        {step === 1 && (
          <BalanceList
            intro="Type today's balance for each account. Leave any that haven't changed."
            rows={(data.accounts ?? []).map((a) => ({
              id: a.id,
              name: a.name,
              value: Number(a.balance),
              currency: a.currency,
            }))}
            table="accounts"
            edits={edits}
            setEdits={setEdits}
            empty="No accounts yet. Add them in My numbers → Accounts."
          />
        )}
        {step === 2 && (
          <BalanceList
            intro="What do you owe on each debt now?"
            rows={data.debts.map((d) => ({
              id: d.id,
              name: d.name,
              value: Number(d.balance),
              currency: d.currency,
            }))}
            table="debts"
            edits={edits}
            setEdits={setEdits}
            empty="No debts. Nice."
          />
        )}
        {step === 3 && (
          <BalanceList
            intro="What is each investment worth today? Check your app or statement."
            rows={data.investments.map((i) => ({
              id: i.id,
              name: i.name,
              value: Number(i.current_value),
              currency: i.currency,
            }))}
            table="investments"
            edits={edits}
            setEdits={setEdits}
            empty="No investments yet."
          />
        )}
        {step === 4 && <Bills data={data} txns={txns} paid={paid} setPaid={setPaid} m={m} />}
        {step === 5 && <Done data={data} history={history} m={m} />}
      </section>

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft /> Back
          </Button>
        ) : (
          <Button variant="ghost" asChild>
            <Link to="/">Later</Link>
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            disabled={saving}
            onClick={() =>
              void saveAndNext(
                ([null, "accounts", "debts", "investments", null] as const)[step] ?? null,
              )
            }
          >
            {saving ? "Saving…" : "Next"} <ArrowRight />
          </Button>
        ) : (
          <Button onClick={finish}>
            <Check /> Finish
          </Button>
        )}
      </div>
    </div>
  );
}

function LastMonth({
  data,
  txns,
  budgets,
  m,
}: {
  data: FinanceData;
  txns: RecentTxn[];
  budgets: { category: string; monthly_limit: number }[];
  m: (n: number) => string;
}) {
  // last day of the previous month, so monthSpend looks at that month
  const [lastMonthDay] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0);
  });
  const spend = useMemo(() => monthSpend(data, txns, lastMonthDay), [data, txns, lastMonthDay]);
  const name = lastMonthDay.toLocaleDateString("en-GB", { month: "long" });
  if (!spend.hasData)
    return (
      <p className="text-sm text-muted-foreground">
        No transactions for {name} yet.{" "}
        <Link to="/spending" className="text-primary underline">
          Import {name}&apos;s statement
        </Link>{" "}
        to see where the money went, or carry on to update your balances.
      </p>
    );
  const limits = new Map(budgets.map((b) => [b.category, Number(b.monthly_limit)]));
  const top = Object.entries(spend.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        You spent <b className="numeric text-foreground">{m(spend.total)}</b> in {name}. Your
        biggest categories:
      </p>
      <ul className="mt-3 space-y-2">
        {top.map(([cat, v]) => {
          const limit = limits.get(cat);
          const over = limit != null && v > limit;
          return (
            <li key={cat} className="flex items-center justify-between gap-3 text-sm">
              <span>{cat}</span>
              <span className={cn("numeric", over && "text-destructive")}>
                {m(v)}
                {limit != null && (
                  <span className="text-xs text-muted-foreground"> / {m(limit)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BalanceList({
  intro,
  rows,
  table,
  edits,
  setEdits,
  empty,
}: {
  intro: string;
  rows: { id: string; name: string; value: number; currency: string }[];
  table: Table;
  edits: Record<string, string>;
  setEdits: (f: (e: Record<string, string>) => Record<string, string>) => void;
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{intro}</p>
      {rows.map((r) => {
        const key = `${table}:${r.id}`;
        return (
          <label key={r.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
            <span className="relative w-40 shrink-0">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">
                {r.currency}
              </span>
              <Input
                inputMode="decimal"
                className="numeric pl-12 text-right"
                value={edits[key] ?? r.value.toLocaleString("en-NG")}
                onChange={(e) =>
                  setEdits((x) => ({ ...x, [key]: e.target.value.replace(/[^\d.,]/g, "") }))
                }
              />
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Bills({
  data,
  txns,
  paid,
  setPaid,
  m,
}: {
  data: FinanceData;
  txns: RecentTxn[];
  paid: Record<string, boolean>;
  setPaid: (f: (p: Record<string, boolean>) => Record<string, boolean>) => void;
  m: (n: number) => string;
}) {
  const bills = useMemo(() => upcomingBills(data, txns), [data, txns]);
  if (!bills.length)
    return (
      <p className="text-sm text-muted-foreground">
        No bills due in the next 30 days that we know of. Import statements so KudiLens can spot
        them.
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Coming up in the next 30 days. Tick any you&apos;ve already paid.
      </p>
      {bills.map((b) => (
        <label
          key={b.label}
          className="flex items-center gap-3 rounded-xl border border-border p-3"
        >
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-primary)]"
            checked={!!paid[b.label]}
            onChange={(e) => setPaid((p) => ({ ...p, [b.label]: e.target.checked }))}
          />
          <span
            className={cn(
              "min-w-0 flex-1 text-sm",
              paid[b.label] && "text-muted-foreground line-through",
            )}
          >
            {b.label}
            <span className="block text-xs text-muted-foreground">
              due {b.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          </span>
          <span className="numeric text-sm">{m(b.amount)}</span>
        </label>
      ))}
    </div>
  );
}

function Done({
  data,
  history,
  m,
}: {
  data: FinanceData;
  history: Parameters<typeof checkInSummary>[0];
  m: (n: number) => string;
}) {
  const now = snapshotOf(data);
  const s = checkInSummary(history, now);
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${m(Math.abs(n))}`;
  return (
    <div className="text-center">
      <PartyPopper className="mx-auto size-10 text-primary" />
      <p className="mt-3 text-lg font-semibold">All up to date</p>
      <p className="numeric mt-1 text-3xl font-semibold">{m(now.net_worth)}</p>
      <p className="text-sm text-muted-foreground">net worth today</p>
      {s && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          {(
            [
              ["Net worth", s.netWorth, true],
              ["Debt", s.debt, false],
              ["Investments", s.investments, true],
            ] as const
          ).map(([label, v, upGood]) => (
            <div key={label} className="rounded-xl bg-secondary/50 p-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p
                className={cn(
                  "numeric font-semibold",
                  Math.abs(v) >= 1 && (v > 0 === upGood ? "text-success" : "text-destructive"),
                )}
              >
                {signed(v)}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Your history and forecasts now use today&apos;s numbers. See you next month.
      </p>
    </div>
  );
}
