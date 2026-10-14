import { useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { NeedsDatabaseUpdate } from "@/components/dashboard/Growth";
import { Meaning } from "@/components/kudi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, project, type FinanceData, type ScenarioChange } from "@/lib/finance";
import { useDeleteScenario, useSaveScenario, useScenarios } from "@/lib/useGrowth";
import { cn } from "@/lib/utils";

const COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-5)"];
const thisYear = new Date().getFullYear();
/** what-ifs never sell investments to cover a cost, matching the dashboard default */
const OPTS = { protectInvestments: true } as const;

const TEMPLATES: { name: string; changes: ScenarioChange[] }[] = [
  {
    name: "Buy a car next year",
    changes: [
      { kind: "oneOff", label: "Car", amount: -12_000_000, year: thisYear + 1 },
      { kind: "monthly", label: "Fuel, insurance & upkeep", amount: -150_000, year: thisYear + 1 },
    ],
  },
  {
    name: "Invest ₦200K more a month",
    changes: [{ kind: "monthly", label: "Extra investing", amount: 200_000, year: thisYear }],
  },
  {
    name: "Pay school fees abroad",
    changes: [
      {
        kind: "monthly",
        label: "Fees",
        amount: -1_500_000,
        year: thisYear + 3,
        endYear: thisYear + 7,
      },
    ],
  },
];

interface Draft {
  id?: string;
  name: string;
  changes: ScenarioChange[];
}

const asChanges = (x: unknown): ScenarioChange[] =>
  Array.isArray(x) ? (x as ScenarioChange[]) : [];

/** Build, save and compare what-if scenarios against the current plan. */
export function WhatIfs({ data, uid }: { data: FinanceData; uid: string }) {
  const saved = useScenarios(uid);
  const save = useSaveScenario(uid);
  const remove = useDeleteScenario(uid);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const cur = data.profile?.base_currency ?? "NGN";
  const short = (n: number) => formatMoney(n, cur, { compact: true });

  const list = saved.data ?? [];
  const compared: Draft[] = [
    ...list
      .filter((s) => picked.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, changes: asChanges(s.changes) })),
    ...(draft && draft.changes.length
      ? [{ ...draft, name: draft.name || "Unsaved scenario" }]
      : []),
  ].slice(0, 3);

  const base = useMemo(() => project(data, 25, 0, OPTS), [data]);
  const runs = useMemo(
    () =>
      compared.map((c) => ({
        name: c.name,
        points: project(data, 25, 0, { ...OPTS, changes: c.changes }),
      })),
    // compared is rebuilt each render; key on its content
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, JSON.stringify(compared)],
  );
  const chart = base.map((p, i) => ({
    label: String(p.year),
    Plan: p.netWorth,
    ...Object.fromEntries(runs.map((r) => [r.name, r.points[i]?.netWorth ?? 0])),
  }));
  const horizons = [5, 10, 25];

  const update = (i: number, patch: Partial<ScenarioChange>) =>
    setDraft(
      (d) => d && { ...d, changes: d.changes.map((c, j) => (j === i ? { ...c, ...patch } : c)) },
    );

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the scenario a name.");
      return;
    }
    save.mutate(
      { ...(draft.id ? { id: draft.id } : {}), name: draft.name.trim(), changes: draft.changes },
      {
        onSuccess: () => {
          toast.success("Scenario saved.");
          setDraft(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold">What-ifs</h2>
        <p className="text-xs text-muted-foreground">
          Compare up to three against your current plan
        </p>
      </div>

      {saved.missing && (
        <div className="mt-3">
          <NeedsDatabaseUpdate feature="Saving what-ifs" />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {list.map((s) => (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1 text-sm",
              picked.includes(s.id) && "border-primary bg-primary/10 text-primary",
            )}
          >
            <button
              onClick={() =>
                setPicked((p) =>
                  p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id].slice(-3),
                )
              }
            >
              {s.name}
            </button>
            <button
              aria-label={`Edit ${s.name}`}
              className="rounded-full px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setDraft({ id: s.id, name: s.name, changes: asChanges(s.changes) })}
            >
              Edit
            </button>
            <button
              aria-label={`Delete ${s.name}`}
              className="rounded-full p-1 text-muted-foreground hover:text-destructive"
              onClick={() => remove.mutate(s.id)}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {!draft &&
          TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => setDraft({ name: t.name, changes: t.changes })}
              className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
            >
              + {t.name}
            </button>
          ))}
        {!draft && (
          <Button size="sm" variant="ghost" onClick={() => setDraft({ name: "", changes: [] })}>
            <Plus /> Blank
          </Button>
        )}
      </div>

      {draft && (
        <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Scenario name, e.g. Buy land in 2028"
          />
          {draft.changes.map((c, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[130px_minmax(0,1fr)_150px_90px_90px_auto] sm:items-center"
            >
              <select
                value={c.kind}
                onChange={(e) => update(i, { kind: e.target.value as ScenarioChange["kind"] })}
                className="h-11 rounded-xl border border-input bg-background/60 px-2 text-sm"
                aria-label="Type"
              >
                <option value="oneOff">One-off</option>
                <option value="monthly">Every month</option>
              </select>
              <Input
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="What"
              />
              <Input
                type="number"
                value={String(c.amount)}
                onChange={(e) => update(i, { amount: Number(e.target.value) })}
                aria-label="Amount (negative = costs money)"
                title="Negative costs you money, positive adds money"
              />
              <Input
                type="number"
                value={String(c.year)}
                onChange={(e) => update(i, { year: Number(e.target.value) })}
                aria-label={c.kind === "oneOff" ? "Year" : "From year"}
              />
              {c.kind === "monthly" ? (
                <Input
                  type="number"
                  value={c.endYear ? String(c.endYear) : ""}
                  placeholder="Until"
                  onChange={(e) =>
                    update(i, { endYear: e.target.value ? Number(e.target.value) : undefined })
                  }
                  aria-label="Until year (optional)"
                />
              ) : (
                <span />
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove line"
                onClick={() =>
                  setDraft({ ...draft, changes: draft.changes.filter((_, j) => j !== i) })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Amounts in {cur}. Negative costs you money (a purchase, a new bill); positive adds money
            (a raise, a windfall, a cost you cut).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft({
                  ...draft,
                  changes: [
                    ...draft.changes,
                    { kind: "oneOff", label: "", amount: 0, year: thisYear + 1 },
                  ],
                })
              }
            >
              <Plus /> Add a change
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={save.isPending || saved.missing}>
              <Save /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {runs.length > 0 ? (
        <>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: 8, right: 8 }}>
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
                  formatter={(v: number) => short(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="Plan"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                {runs.map((r, i) => (
                  <Line
                    key={r.name}
                    type="monotone"
                    dataKey={r.name}
                    stroke={COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-left font-normal">Net worth</th>
                  {horizons.map((h) => (
                    <th key={h} className="py-1.5 text-right font-normal">
                      In {h} yrs
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="numeric">
                <tr className="border-t border-border">
                  <td className="py-1.5 font-sans">Current plan</td>
                  {horizons.map((h) => (
                    <td key={h} className="py-1.5 text-right">
                      {short(base[h]?.netWorth ?? 0)}
                    </td>
                  ))}
                </tr>
                {runs.map((r) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="py-1.5 font-sans">{r.name}</td>
                    {horizons.map((h) => {
                      const diff = (r.points[h]?.netWorth ?? 0) - (base[h]?.netWorth ?? 0);
                      return (
                        <td key={h} className="py-1.5 text-right">
                          {short(r.points[h]?.netWorth ?? 0)}
                          <span
                            className={cn(
                              "block text-[11px]",
                              diff >= 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {diff >= 0 ? "+" : "−"}
                            {short(Math.abs(diff))}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Pick a saved scenario or start from an example to see how it changes your future.
        </p>
      )}
      <Meaning>
        Each scenario runs the same expected-case projection as the dashboard, with your changes
        added in the years you choose. Money a scenario costs comes out of cash first; investments
        are kept separate.
      </Meaning>
    </section>
  );
}
