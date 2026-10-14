import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Compass,
  Home,
  MessageCircle,
  PlayCircle,
  Receipt,
  Settings,
  Table2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { readLock } from "@/lib/applock";
import { isStandalone } from "@/lib/pwa";
import { startTour } from "@/lib/tour";
import { useFinance } from "@/lib/useFinance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "How KudiLens works" },
      {
        name: "description",
        content: "A plain-English guide to every part of KudiLens and how to get started.",
      },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <AppShell>
      <Guide />
    </AppShell>
  );
}

const SECTIONS: { icon: LucideIcon; title: string; to: string; what: string; use: string[] }[] = [
  {
    icon: Table2,
    title: "My numbers: start here",
    to: "/records",
    what: "Everything KudiLens knows about your money. Every chart, forecast and tip is worked out from what you put here.",
    use: [
      "Add your take-home pay and monthly costs under Income & spending.",
      "Add bank balances, investments, property, debts, family and goals in their tabs.",
      "Leave 'Fill from live data' on so inflation and exchange-rate assumptions stay current.",
    ],
  },
  {
    icon: Home,
    title: "Dashboard: your money at a glance",
    to: "/",
    what: "Your net worth today and in 10 years, a plain-English summary of what to do next, and what's safe to spend this month.",
    use: [
      "Read 'What the data says' first. Open the detailed breakdown when you want the reasoning.",
      "Check 'Safe to spend' before a big purchase.",
      "Do the monthly check-in at the start of each month to keep your history accurate.",
    ],
  },
  {
    icon: Compass,
    title: "Plan: what happens next",
    to: "/plan",
    what: "Forecasts that show good and bad cases, your chances of reaching each goal, the fastest way out of debt, and what-if scenarios.",
    use: [
      "Each goal tells you where to keep its money and how much to save a month.",
      "Try a what-if, e.g. 'Buy a car next year', to see its cost in 5, 10 and 25 years.",
      "Tap any underlined number to see exactly how it was calculated.",
    ],
  },
  {
    icon: TrendingUp,
    title: "Invest: where to grow it",
    to: "/invest",
    what: "Licensed investment platforms for your country, how funds have actually performed, and a check of your own mix.",
    use: [
      "Set your country in Settings to see the right regulators and platforms.",
      "Compare Nigerian fund yields from the SEC report, or global ETF returns.",
      "'My wealth check' shows when you could stop needing a salary.",
    ],
  },
  {
    icon: Receipt,
    title: "Spending: where it actually goes",
    to: "/spending",
    what: "Import a bank statement (CSV or PDF) and KudiLens sorts every transaction, finds subscriptions and tracks budgets.",
    use: [
      "Import last month's statement, then set budgets with 'Suggest from my spending'.",
      "Add sinking funds for yearly costs like school fees so they never surprise you.",
      "Once imported, the dashboard can use your real spending in forecasts.",
    ],
  },
  {
    icon: MessageCircle,
    title: "Ask Kudi: questions in your own words",
    to: "/advisor",
    what: "A chat that answers using your numbers, like 'Should I pay off my loan or invest?'.",
    use: [
      "Ask about trade-offs, timing or what a number means.",
      "Answers are education, not licensed financial advice.",
    ],
  },
  {
    icon: Settings,
    title: "Settings: privacy and security",
    to: "/settings",
    what: "Your country, theme, app lock (PIN or Face ID), two-step login, email and password, and your data.",
    use: [
      "Turn on app lock if others use your phone.",
      "Tap the eye at the top any time to hide all amounts.",
      "Download or delete your data whenever you like.",
    ],
  },
];

function Guide() {
  const { user } = useAuth();
  const { data } = useFinance(user?.id);
  const [device, setDevice] = useState({ lock: false, installed: false });
  useEffect(() => setDevice({ lock: !!readLock(), installed: isStandalone() }), []);

  const country = (user?.user_metadata as { country?: string } | undefined)?.country;
  const checklist: { done: boolean; label: string; to: string }[] = data
    ? [
        {
          done: data.flows.some((f) => f.flow_type === "income"),
          label: "Add your take-home pay",
          to: "/records",
        },
        {
          done: data.flows.some((f) => f.flow_type === "expense"),
          label: "Add your monthly costs",
          to: "/records",
        },
        { done: (data.accounts ?? []).length > 0, label: "Add your bank balances", to: "/records" },
        { done: data.investments.length > 0, label: "Add your investments", to: "/records" },
        { done: (data.goals ?? []).length > 0, label: "Set a goal", to: "/records" },
        {
          done: (data.actualSpend?.months ?? 0) > 0,
          label: "Import a bank statement",
          to: "/spending",
        },
        { done: !!country, label: "Choose your country", to: "/settings" },
        { done: device.lock, label: "Turn on app lock", to: "/settings" },
        { done: device.installed, label: "Install the app on your phone", to: "/settings" },
      ]
    : [];
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">How KudiLens works</h1>
          <p className="text-sm text-muted-foreground">
            KudiLens turns your numbers into a clear picture of your money today, where it&apos;s
            heading, and what to do next.
          </p>
        </div>
        <Button onClick={startTour}>
          <PlayCircle /> Take the tour
        </Button>
      </div>

      {checklist.length > 0 && (
        <section className="panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Getting started</h2>
            <p className="numeric text-sm text-muted-foreground">
              {done} of {checklist.length} done
            </p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  to={c.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent",
                    c.done && "text-muted-foreground",
                  )}
                >
                  {c.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(c.done && "line-through")}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Every section, explained</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <article key={s.title} className="panel flex flex-col p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                  <s.icon className="size-5" />
                </span>
                <h3 className="font-semibold">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm">{s.what}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {s.use.map((u) => (
                  <li key={u} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    {u}
                  </li>
                ))}
              </ul>
              <Link to={s.to} className="mt-4 text-sm font-medium text-primary hover:underline">
                Open {s.title.split(":")[0]} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Getting around</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">On a phone:</b> the bar at the bottom has Home, Plan,
            Invest and Ask Kudi. Everything else (Spending, My numbers, Settings, this guide) is
            under <b className="text-foreground">More</b>.
          </li>
          <li>
            <b className="text-foreground">On a computer:</b> every section is in the menu on the
            left.
          </li>
          <li>
            <b className="text-foreground">Underlined numbers</b> can be tapped to show exactly how
            they were worked out.
          </li>
          <li>
            <b className="text-foreground">Amounts</b> are shown in your base currency (set in My
            numbers → Profile) at today&apos;s exchange rates, shown at the top of each page.
          </li>
        </ul>
      </section>
    </div>
  );
}
