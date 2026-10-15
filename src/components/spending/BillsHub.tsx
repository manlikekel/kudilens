import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CreditCard, Repeat, Undo2 } from "lucide-react";
import { Meaning } from "@/components/kudi";
import { Button } from "@/components/ui/button";
import {
  convert,
  detectRecurring,
  formatMoney,
  getRates,
  isBill,
  sinkingFunds,
  type FinanceData,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

type Flag = "keep" | "cancel" | "cancelled";
const FLAGS_KEY = "kudi-bill-flags";

function useFlags() {
  const [flags, setFlags] = useState<Record<string, Flag>>({});
  useEffect(() => {
    try {
      setFlags(JSON.parse(localStorage.getItem(FLAGS_KEY) ?? "{}") as Record<string, Flag>);
    } catch {
      /* start empty */
    }
  }, []);
  const set = (merchant: string, flag: Flag | null) =>
    setFlags((f) => {
      const next = { ...f };
      if (flag) next[merchant] = flag;
      else delete next[merchant];
      try {
        localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
      } catch {
        /* still applies for this visit */
      }
      return next;
    });
  return [flags, set] as const;
}

const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Every recurring payment in one place, with a keep / cancel decision on subscriptions. */
export function BillsHub({
  data,
  items,
}: {
  data: FinanceData | undefined;
  items: ReturnType<typeof detectRecurring>;
}) {
  const [flags, setFlag] = useFlags();
  const cur = data?.profile?.base_currency ?? "NGN";
  const m = (n: number) => formatMoney(n, cur);
  const rates = data ? getRates(data) : null;
  const toBase = (minor: number) => (rates ? convert(minor / 100, "NGN", cur, rates) : minor / 100);

  const subs = items.filter((i) => i.isSubscription);
  const bills = items.filter((i) => !i.isSubscription && isBill(i.category));
  const debts = (data?.debts ?? []).filter(
    (d) => Number(d.balance) > 0 && Number(d.minimum_payment) > 0,
  );
  const yearly = useMemo(() => (data ? sinkingFunds(data) : []), [data]);

  const active = (merchant: string) => flags[merchant] !== "cancelled";
  const monthly =
    [...subs, ...bills]
      .filter((i) => active(i.merchant))
      .reduce((t, i) => t + toBase(i.typicalMinor), 0) +
    debts.reduce(
      (t, d) => t + (rates ? convert(Number(d.minimum_payment), d.currency, cur, rates) : 0),
      0,
    ) +
    yearly.reduce((t, f) => t + f.monthly, 0);
  const flaggedYear = subs
    .filter((s) => flags[s.merchant] === "cancel")
    .reduce((t, s) => t + toBase(s.annualMinor), 0);
  const savedYear = subs
    .filter((s) => flags[s.merchant] === "cancelled")
    .reduce((t, s) => t + toBase(s.annualMinor), 0);
  const undecided = subs.filter((s) => !flags[s.merchant]).length;

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Recurring costs</p>
            <p className="numeric text-2xl font-semibold">{m(monthly)}</p>
            <p className="text-xs text-muted-foreground">
              a month, including debts and yearly costs spread out
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Flagged to cancel</p>
            <p className="numeric text-2xl font-semibold text-warning">{m(flaggedYear)}</p>
            <p className="text-xs text-muted-foreground">a year you could save</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Already cancelled</p>
            <p className="numeric text-2xl font-semibold text-success">{m(savedYear)}</p>
            <p className="text-xs text-muted-foreground">a year saved</p>
          </div>
        </div>
        {undecided > 0 && (
          <p className="mt-4 rounded-xl bg-warning/12 px-3 py-2 text-sm text-warning">
            {undecided} subscription{undecided === 1 ? "" : "s"} to review: tap Keep or Cancel this.
          </p>
        )}
      </section>

      <Group
        title="Subscriptions"
        icon={Repeat}
        empty="No subscriptions found in your statements yet."
      >
        {subs.map((s) => {
          const flag = flags[s.merchant];
          return (
            <li
              key={s.merchant}
              className={cn(
                "rounded-xl border border-border p-3",
                flag === "cancelled" && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("font-medium", flag === "cancelled" && "line-through")}>
                    {s.merchant}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.category} · next around {shortDate(s.nextDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="numeric text-sm font-semibold">{m(toBase(s.typicalMinor))}/mo</p>
                  <p className="numeric text-xs text-muted-foreground">
                    {m(toBase(s.annualMinor))} a year
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {flag === "cancelled" ? (
                  <Button size="sm" variant="ghost" onClick={() => setFlag(s.merchant, null)}>
                    <Undo2 /> Undo
                  </Button>
                ) : flag === "cancel" ? (
                  <>
                    <span className="text-xs text-warning">
                      Cancel this? It would save {m(toBase(s.annualMinor))} a year.
                    </span>
                    <Button size="sm" onClick={() => setFlag(s.merchant, "cancelled")}>
                      I've cancelled it
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFlag(s.merchant, "keep")}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <>
                    {!flag && (
                      <span className="text-xs text-muted-foreground">Still using it?</span>
                    )}
                    <Button
                      size="sm"
                      variant={flag === "keep" ? "secondary" : "outline"}
                      onClick={() => setFlag(s.merchant, "keep")}
                    >
                      {flag === "keep" ? "Keeping" : "Keep"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFlag(s.merchant, "cancel")}
                    >
                      Cancel this?
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </Group>

      <Group title="Regular bills" icon={CalendarClock} empty="No other repeating bills found yet.">
        {bills.map((b) => (
          <Row
            key={b.merchant}
            title={b.merchant}
            sub={`${b.category} · next around ${shortDate(b.nextDate)}`}
            amount={`${m(toBase(b.typicalMinor))}/mo`}
          />
        ))}
      </Group>

      <Group title="Debt payments" icon={CreditCard} empty="No debts with monthly payments.">
        {debts.map((d) => (
          <Row
            key={d.id}
            title={d.name}
            sub={`${formatMoney(Number(d.balance), d.currency)} left`}
            amount={`${formatMoney(Number(d.minimum_payment), d.currency)}/mo`}
          />
        ))}
      </Group>

      <Group
        title="Yearly costs"
        icon={CalendarClock}
        empty="No yearly costs yet. Add school fees, rent or insurance in My numbers."
      >
        {yearly.map((f) => (
          <Row
            key={f.id}
            title={f.label}
            sub={`${m(f.amount)} due ${shortDate(f.nextDue)}`}
            amount={`${m(f.monthly)}/mo to set aside`}
          />
        ))}
      </Group>

      <Meaning>
        Subscriptions and bills are found in your imported statements: payments to the same place
        about once a month for a similar amount. Import at least two months to see them all. Your
        keep and cancel choices are saved on this device.
      </Meaning>
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof Repeat;
  empty: string;
  children: React.ReactNode;
}) {
  const list = Array.isArray(children) ? children : [children];
  return (
    <section className="panel p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </h3>
      {list.length ? (
        <ul className="mt-3 space-y-2">{children}</ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function Row({ title, sub, amount }: { title: string; sub: string; amount: string }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <p className="numeric shrink-0 text-sm font-semibold">{amount}</p>
    </li>
  );
}
