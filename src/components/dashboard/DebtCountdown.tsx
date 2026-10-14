import { Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { debtFreePlan, formatMoney, type FinanceData } from "@/lib/finance";

const SEEN_KEY = "kudi-debts-seen";
const monthYear = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** Celebrates debts that were open last visit and are gone now (cleared or deleted at zero). */
function useDebtMilestones(data: FinanceData) {
  useEffect(() => {
    const open = Object.fromEntries(
      data.debts.filter((d) => Number(d.balance) > 0).map((d) => [d.id, d.name]),
    );
    try {
      const before = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null") as Record<
        string,
        string
      > | null;
      if (before) {
        const cleared = Object.entries(before).filter(([id]) => !(id in open));
        for (const [, name] of cleared)
          toast.success(`You cleared ${name}! One less debt.`, {
            icon: <PartyPopper className="size-4" />,
          });
        if (cleared.length && Object.keys(open).length === 0)
          toast.success("You're debt-free. Huge milestone!", {
            icon: <PartyPopper className="size-4" />,
          });
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(open));
    } catch {
      /* storage unavailable */
    }
  }, [data.debts]);
}

export function DebtCountdown({ data }: { data: FinanceData }) {
  useDebtMilestones(data);
  const plan = useMemo(() => debtFreePlan(data), [data]);
  const cur = data.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);
  if (plan.totalDebt <= 0) return null;

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Debt-free countdown</h2>
          <p className="text-sm text-muted-foreground">
            If you keep paying {m(plan.monthlyPayment)} a month in total
          </p>
        </div>
        <Link to="/plan" className="shrink-0 text-sm text-primary hover:underline">
          Speed it up →
        </Link>
      </div>

      {plan.months == null ? (
        <p className="mt-4 rounded-xl bg-destructive/12 p-3 text-sm text-destructive">
          At these payments your debts never get paid off: interest grows faster than you pay. Raise
          a monthly payment in My numbers → Debts.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-end gap-3">
            <p className="numeric text-4xl font-semibold tracking-tight text-primary">
              {plan.months}
            </p>
            <p className="pb-1 text-sm text-muted-foreground">
              month{plan.months === 1 ? "" : "s"} to go · debt-free by{" "}
              <b className="text-foreground">{monthYear(plan.debtFreeDate!)}</b>
            </p>
          </div>
          <ol className="mt-4 space-y-2">
            {plan.milestones.map((ms, i) => (
              <li key={ms.id} className="flex items-center gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{ms.name}</span>
                <span className="numeric text-muted-foreground">{monthYear(ms.date)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            {m(plan.totalDebt)} owed today · {m(plan.totalInterest)} interest still to pay. Each
            cleared debt&apos;s payment rolls onto the next, highest interest rate first.
          </p>
        </>
      )}
    </section>
  );
}
