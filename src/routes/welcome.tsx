import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, type CountryCode } from "@/lib/invest/directory";
import { cn } from "@/lib/utils";
import { ONBOARDED_KEY } from "@/lib/onboarding";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Set up KudiLens" }] }),
  component: Welcome,
});

interface Answers {
  name: string;
  age: string;
  retire: string;
  country: CountryCode;
  income: string;
  spending: string;
  dependents: string;
  familyCost: string;
  cash: string;
  invested: string;
  investing: string;
  debt: string;
  debtPayment: string;
}

const STEPS = ["You", "Income", "Spending", "Savings", "Debts"] as const;

/** A two-minute guided setup that fills My numbers with the essentials. */
function Welcome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<Answers>({
    name: "",
    age: "",
    retire: "60",
    country: "NG",
    income: "",
    spending: "",
    dependents: "0",
    familyCost: "",
    cash: "",
    invested: "",
    investing: "",
    debt: "",
    debtPayment: "",
  });
  const set = (k: keyof Answers, v: string) => setA((x) => ({ ...x, [k]: v }));
  const country = COUNTRIES.find((c) => c.code === a.country)!;
  const cur = country.currency;
  const n = (s: string) => Math.max(0, Number(s.replace(/,/g, "")) || 0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    const metaName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name;
    if (metaName) setA((x) => (x.name ? x : { ...x, name: metaName }));
  }, [loading, user, navigate]);

  const done = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  async function finish() {
    if (!user) return;
    setBusy(true);
    try {
      const uid = user.id;
      const results = await Promise.all([
        supabase.from("profiles").upsert({
          id: uid,
          full_name: a.name || null,
          age: n(a.age) || null,
          retirement_age: n(a.retire) || null,
          base_currency: cur,
        }),
        supabase.auth.updateUser({ data: { country: a.country } }),
        n(a.income) &&
          supabase.from("cash_flows").insert({
            user_id: uid,
            label: "Take-home pay",
            flow_type: "income",
            category: "Salary",
            monthly_amount: n(a.income),
            currency: cur,
          }),
        n(a.spending) &&
          supabase.from("cash_flows").insert({
            user_id: uid,
            label: "Living costs",
            flow_type: "expense",
            category: "Living",
            monthly_amount: n(a.spending),
            currency: cur,
          }),
        n(a.dependents) > 0 &&
          supabase.from("family_members").insert(
            Array.from({ length: Math.min(10, n(a.dependents)) }, (_, i) => ({
              user_id: uid,
              name: `Dependant ${i + 1}`,
              relationship: "child",
              age: 5,
              dependent: true,
              monthly_cost: Math.round(n(a.familyCost) / Math.max(1, n(a.dependents))),
              currency: cur,
            })),
          ),
        n(a.cash) &&
          supabase.from("accounts").insert({
            user_id: uid,
            name: "Main account",
            kind: "bank",
            balance: n(a.cash),
            currency: cur,
            is_emergency_fund: false,
          }),
        (n(a.invested) || n(a.investing)) &&
          supabase.from("investments").insert({
            user_id: uid,
            name: "My investments",
            asset_class: "money market",
            current_value: n(a.invested),
            currency: cur,
            monthly_contribution: n(a.investing),
            expected_return: a.country === "NG" ? 16 : 5,
          }),
        n(a.debt) &&
          supabase.from("debts").insert({
            user_id: uid,
            name: "My debts",
            kind: "personal loan",
            balance: n(a.debt),
            currency: cur,
            interest_rate: a.country === "NG" ? 25 : 8,
            minimum_payment: n(a.debtPayment),
          }),
      ]);
      const failed = results.find((r) => r && typeof r === "object" && "error" in r && r.error);
      if (failed && typeof failed === "object" && "error" in failed && failed.error)
        throw failed.error;
      done();
      await qc.invalidateQueries();
      toast.success("You're set up. Fine-tune anything in My numbers.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const money = (k: keyof Answers, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <div className="relative">
        <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">
          {cur}
        </span>
        <Input
          id={k}
          inputMode="decimal"
          value={a[k]}
          onChange={(e) => set(k, e.target.value.replace(/[^\d.,]/g, ""))}
          className="numeric pl-14"
          placeholder="0"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  const body = [
    <div key="you" className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">What should we call you?</Label>
        <Input
          id="name"
          value={a.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="given-name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            inputMode="numeric"
            value={a.age}
            onChange={(e) => set("age", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="retire">Retire at</Label>
          <Input
            id="retire"
            inputMode="numeric"
            value={a.retire}
            onChange={(e) => set("retire", e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Where do you live?</Label>
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => set("country", c.code)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border px-3 py-3 text-left text-sm hover:bg-accent",
                a.country === c.code && "border-primary bg-primary/10",
              )}
            >
              <span className="text-lg">{c.flag}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>,
    <div key="income" className="space-y-4">
      {money(
        "income",
        "Monthly take-home pay",
        "After tax and pension. Add other income later in My numbers.",
      )}
    </div>,
    <div key="spending" className="space-y-4">
      {money(
        "spending",
        "Monthly living costs",
        "Rent, food, transport, bills: a rough number is fine to start.",
      )}
      <div className="space-y-1.5">
        <Label htmlFor="dependents">People who depend on you</Label>
        <Input
          id="dependents"
          inputMode="numeric"
          value={a.dependents}
          onChange={(e) => set("dependents", e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {n(a.dependents) > 0 && money("familyCost", "What they cost you a month, in total")}
    </div>,
    <div key="savings" className="space-y-4">
      {money("cash", "Money in your bank accounts")}
      {money(
        "invested",
        "Money already invested",
        "Funds, stocks, savings apps. Split it up later in My numbers.",
      )}
      {money("investing", "How much you invest each month")}
    </div>,
    <div key="debts" className="space-y-4">
      {money(
        "debt",
        "Total you owe",
        "Loans, credit cards, money owed to family. Leave empty if none.",
      )}
      {n(a.debt) > 0 && money("debtPayment", "What you pay towards it each month")}
    </div>,
  ];

  return (
    <div className="flex min-h-dvh flex-col items-center px-safe pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5">
          <img src="/icons/icon.svg" alt="" className="size-9 rounded-xl" />
          <span className="font-display text-lg font-semibold">
            Kudi<span className="text-primary">Lens</span>
          </span>
        </div>
        <div className="mt-8 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn("h-1.5 flex-1 rounded-full bg-secondary", i <= step && "bg-primary")}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {
            [
              "Let's set up your money picture",
              "What comes in",
              "What goes out",
              "What you have",
              "What you owe",
            ][step]
          }
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two minutes. You can change everything later.
        </p>

        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) setStep(step + 1);
            else void finish();
          }}
        >
          {body[step]}
          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  done();
                  navigate({ to: "/" });
                }}
              >
                Skip for now
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {step < STEPS.length - 1 ? (
                <>
                  Next <ArrowRight />
                </>
              ) : busy ? (
                "Saving…"
              ) : (
                <>
                  <Check /> See my dashboard
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
