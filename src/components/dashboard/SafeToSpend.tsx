import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Num } from "@/components/kudi";
import { formatMoney, safeToSpend, type FinanceData } from "@/lib/finance";
import type { RecentTxn } from "@/lib/useGrowth";
import { cn } from "@/lib/utils";

/** How much is free to spend for the rest of this month, and per day. */
export function SafeToSpend({ data, txns }: { data: FinanceData; txns: RecentTxn[] }) {
  const [open, setOpen] = useState(false);
  const s = useMemo(() => safeToSpend(data, txns), [data, txns]);
  const cur = data.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);
  const rows: [string, number][] = [
    ["Monthly income", s.income],
    ["Debt payments", -s.debtPayments],
    ["Investing", -s.investing],
    ["Set aside for yearly costs", -s.sinking],
    [s.mode === "live" ? "Spent so far this month" : "Planned living & family costs", -s.spending],
    ...(s.mode === "live"
      ? ([["Bills still to come", -s.upcomingBills]] as [string, number][])
      : []),
  ];

  return (
    <section className="panel p-5" data-tour="safe-to-spend">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Safe to spend this month
          </p>
          <p
            className={cn(
              "numeric mt-1 text-3xl font-semibold tracking-tight",
              s.safe >= 0 ? "text-success" : "text-destructive",
            )}
          >
            <Num formula="Income − debt payments − investing − money set aside for yearly costs − spending (and, once this month's statement is imported, bills still to come). What's left is free to spend without touching your plans.">
              {m(s.safe)}
            </Num>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.safe > 0
              ? `About ${m(s.perDay)} a day for the next ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}`
              : "You're over for this month. Cut back or move money from savings."}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
            s.mode === "live" ? "bg-success/12 text-success" : "bg-secondary text-muted-foreground",
          )}
        >
          {s.mode === "live" ? "From your statements" : "From your plan"}
        </span>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="mt-3 flex items-center gap-1 text-sm text-primary"
        aria-expanded={open}
      >
        How it&apos;s worked out
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {rows.map(([label, v]) => (
            <li key={label} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{label}</span>
              <span className="numeric">{Math.abs(v) < 1 ? m(0) : v > 0 ? m(v) : `−${m(-v)}`}</span>
            </li>
          ))}
          {s.bills.map((b) => (
            <li
              key={b.merchant}
              className="flex justify-between gap-3 pl-4 text-xs text-muted-foreground"
            >
              <span>
                {b.merchant} · due around{" "}
                {new Date(b.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
              <span className="numeric">{m(b.amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-border pt-1.5 font-medium">
            <span>Safe to spend</span>
            <span className="numeric">{m(s.safe)}</span>
          </li>
        </ul>
      )}
      {s.mode === "plan" && (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link to="/spending" className="text-primary underline">
            Import this month&apos;s bank statement
          </Link>{" "}
          to base this on what you&apos;ve actually spent.
        </p>
      )}
    </section>
  );
}
