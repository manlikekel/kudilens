import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { SAVINGS_VEHICLES } from "@/lib/finance";
import {
  type TableName,
  useFinance,
  useUpsertRow,
  useDeleteRow,
  useSaveProfile,
  useMarket,
  useLiveAssumptions,
} from "@/lib/useFinance";
import type { LiveValue, MarketAssumptions } from "@/lib/finance";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "My numbers — KudiLens" },
      {
        name: "description",
        content: "Enter your profile, family, income, spending, debts and investments for analysis.",
      },
      { property: "og:title", content: "My numbers — KudiLens" },
      {
        property: "og:description",
        content: "Your profile, family, cash flows, debts and investments in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  return (
    <AppShell>
      <Records />
    </AppShell>
  );
}

type Draft = Record<string, string | number | boolean | null>;

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "CAD"];

function Records() {
  const { user } = useAuth();
  const { data, isLoading, error } = useFinance(user?.id);
  const [tab, setTab] = useState("profile");

  if (isLoading) return <p className="text-muted-foreground">Loading your numbers…</p>;
  if (error) return <p className="text-destructive">Could not load data: {error.message}</p>;
  if (!data || !user) return null;

  const cur = data.profile?.base_currency ?? "NGN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My numbers</h1>
        <p className="text-sm text-muted-foreground">
          Everything the analysis uses — keep it current and the projections stay honest.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-scrollbar flex h-auto w-full justify-start overflow-x-auto rounded-xl p-1 [&>*]:shrink-0">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="assets">Property &amp; assets</TabsTrigger>
          <TabsTrigger value="family">Family</TabsTrigger>
          <TabsTrigger value="flows">Income &amp; spending</TabsTrigger>
          <TabsTrigger value="debts">Debts</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="lumps">Yearly costs</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection data={data} />
        </TabsContent>
        <TabsContent value="accounts">
          <Section
            table="accounts"
            userId={user.id}
            rows={(data.accounts ?? []) as unknown as Draft[]}
            defaults={{ name: "", kind: "bank", balance: 0, currency: cur, is_emergency_fund: false }}
            fields={[
              { key: "name", label: "Account (e.g. GTBank savings, Dom account)" },
              { key: "kind", label: "Type", select: ["bank", "cash", "wallet", "domiciliary"] },
              { key: "balance", label: "Balance", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "is_emergency_fund", label: "This is my emergency fund", bool: true },
            ]}
            title={(r) => String(r["name"]) || "New account"}
            emptyText="No bank, cash or wallet accounts yet. Add them so forecasts start from your real cash."
          />
        </TabsContent>
        <TabsContent value="assets">
          <Section
            table="assets"
            userId={user.id}
            rows={(data.assets ?? []) as unknown as Draft[]}
            defaults={{ name: "", kind: "land", current_value: 0, currency: cur, appreciation: 10, liquid: false }}
            fields={[
              { key: "name", label: "Asset (e.g. Plot in Lugbe, Car, RSA pension)" },
              { key: "kind", label: "Type", select: ["land", "property", "vehicle", "pension", "other"] },
              { key: "current_value", label: "Current value", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "appreciation", label: "Expected growth %/yr (negative for cars)", num: true },
              { key: "liquid", label: "Can be sold within a month", bool: true },
            ]}
            title={(r) => String(r["name"]) || "New asset"}
            emptyText="No land, property, vehicles or pension recorded yet."
          />
        </TabsContent>
        <TabsContent value="family">
          <Section
            table="family_members"
            userId={user.id}
            rows={data.family as unknown as Draft[]}
            defaults={{ name: "", relationship: "child", age: 5, dependent: true, monthly_cost: 0, currency: cur }}
            fields={[
              { key: "name", label: "Name" },
              { key: "relationship", label: "Relationship", select: ["spouse", "child", "parent", "other"] },
              { key: "age", label: "Age", num: true },
              { key: "dependent", label: "Depends on my income", bool: true },
              { key: "monthly_cost", label: "Monthly cost", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
            ]}
            title={(r) => String(r["name"]) || "New member"}
            emptyText="No family members added yet."
          />
        </TabsContent>
        <TabsContent value="flows">
          <Section
            table="cash_flows"
            userId={user.id}
            rows={data.flows as unknown as Draft[]}
            defaults={{ label: "", flow_type: "income", category: "Salary", monthly_amount: 0, currency: cur, growth_rate: 0 }}
            fields={[
              { key: "label", label: "Description" },
              { key: "flow_type", label: "Type", select: ["income", "expense"] },
              { key: "category", label: "Category" },
              { key: "monthly_amount", label: "Monthly amount", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "growth_rate", label: "Annual growth %", num: true },
            ]}
            title={(r) => String(r["label"]) || "New flow"}
            emptyText="No income or expenses added yet."
          />
        </TabsContent>
        <TabsContent value="debts">
          <Section
            table="debts"
            userId={user.id}
            rows={data.debts as unknown as Draft[]}
            defaults={{ name: "", kind: "personal loan", balance: 0, currency: cur, interest_rate: 20, minimum_payment: 0, notes: null }}
            fields={[
              { key: "name", label: "Name" },
              {
                key: "kind",
                label: "Type",
                select: ["credit card", "personal loan", "car loan", "mortgage", "family loan", "other"],
              },
              { key: "balance", label: "Balance owed", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "interest_rate", label: "Interest rate %/yr", num: true },
              { key: "minimum_payment", label: "Minimum monthly payment", num: true },
              { key: "notes", label: "Notes", area: true },
            ]}
            title={(r) => String(r["name"]) || "New debt"}
            emptyText="No debts added yet."
          />
        </TabsContent>
        <TabsContent value="investments">
          <Section
            table="investments"
            userId={user.id}
            rows={data.investments as unknown as Draft[]}
            defaults={{ name: "", asset_class: "stocks", current_value: 0, currency: cur, monthly_contribution: 0, expected_return: 8, notes: null }}
            fields={[
              { key: "name", label: "Name" },
              {
                key: "asset_class",
                label: "Asset class",
                select: ["stocks", "bonds", "money market", "t-bills", "real estate", "cash", "crypto", "pension", "business", "other"],
              },
              { key: "current_value", label: "Current value", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "monthly_contribution", label: "Monthly contribution", num: true },
              { key: "expected_return", label: "Expected return %/yr", num: true },
              { key: "notes", label: "Notes", area: true },
            ]}
            title={(r) => String(r["name"]) || "New investment"}
            emptyText="No investments added yet."
          />
        </TabsContent>
        <TabsContent value="goals">
          <Section
            table="goals"
            userId={user.id}
            rows={(data.goals ?? []) as unknown as Draft[]}
            defaults={{ name: "", target_amount: 0, currency: cur, target_year: new Date().getFullYear() + 5, target_month: 12, current_saved: 0, monthly_contribution: 0, priority: 3, saved_in: "money market", goal_inflation: null, linked_account_id: null }}
            fields={[
              { key: "name", label: "Goal (e.g. Canada relocation, House build)" },
              { key: "target_amount", label: "Target amount (today's prices)", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "target_year", label: "Target year", num: true },
              { key: "target_month", label: "Target month (1–12)", num: true },
              { key: "saved_in", label: "Money is saved in", choices: Object.entries(SAVINGS_VEHICLES).map(([k, v]) => [k, v.label]) },
              { key: "goal_inflation", label: "Cost inflation %/yr (blank = general inflation)", num: true, nullable: true },
              { key: "linked_account_id", label: "Linked account (uses its balance)", choices: [["", "Not linked"], ...(data.accounts ?? []).map((a) => [a.id, a.name] as [string, string])] },
              { key: "current_saved", label: "Already saved (if not linked)", num: true },
              { key: "monthly_contribution", label: "Saving per month", num: true },
              { key: "priority", label: "Priority (1 = most important)", num: true },
            ]}
            title={(r) => String(r["name"]) || "New goal"}
            emptyText="No goals yet. Add one to see your odds of reaching it."
          />
        </TabsContent>
        <TabsContent value="lumps">
          <Section
            table="lump_costs"
            userId={user.id}
            rows={(data.lumps ?? []) as unknown as Draft[]}
            defaults={{ label: "", amount: 0, currency: cur, months: [] as unknown as string }}
            fields={[
              { key: "label", label: "Cost (e.g. School fees, Rent renewal, Festive season)" },
              { key: "amount", label: "Amount each time", num: true },
              { key: "currency", label: "Currency", select: CURRENCIES },
              { key: "months", label: "Months due (numbers, e.g. 1, 5, 9)", list: true },
            ]}
            title={(r) => String(r["label"]) || "New cost"}
            emptyText="No once-a-year costs yet — add school fees, rent and festive spending."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- profile ---------------- */

function ProfileSection({ data }: { data: NonNullable<ReturnType<typeof useFinance>["data"]> }) {
  const { user } = useAuth();
  const save = useSaveProfile(user?.id);
  const p = data.profile;
  const [form, setForm] = useState<Draft>({
    full_name: p?.full_name ?? "",
    age: p?.age ?? 30,
    retirement_age: p?.retirement_age ?? 60,
    base_currency: p?.base_currency ?? "NGN",
    inflation_rate: p?.inflation_rate ?? 25,
    risk_tolerance: p?.risk_tolerance ?? "balanced",
    goals: p?.goals ?? "",
    fx_depreciation: p?.fx_depreciation ?? 15,
    education_inflation: p?.education_inflation ?? 20,
    salary_growth: p?.salary_growth ?? 10,
    income_stability: p?.income_stability ?? "stable",
    emergency_fund: p?.emergency_fund ?? 0,
    life_cover: p?.life_cover ?? 0,
    health_cover: p?.health_cover ?? 0,
    inflation_fx_correlation: p?.inflation_fx_correlation ?? 0.6,
    cash_yield_ratio: p?.cash_yield_ratio ?? 0.5,
    foreign_inflation: p?.foreign_inflation ?? 3,
    grow_contributions: p?.grow_contributions ?? true,
  });
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries((p?.fx_overrides as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const official = Object.fromEntries((data.fxRates ?? []).map((r) => [r.currency, r]));
  const set = (k: string, v: Draft[string]) => setForm((f) => ({ ...f, [k]: v }));
  const liveOn = (user?.user_metadata as { live_assumptions?: boolean } | undefined)?.live_assumptions !== false;
  const market = useMarket().data;
  const toggleLive = useLiveAssumptions(user?.id);
  /** the live value for a profile field, when live data is on and available */
  const live = (k: string): LiveValue | undefined =>
    liveOn && market ? market[LIVE_FIELDS[k] as keyof MarketAssumptions] as LiveValue | undefined : undefined;
  const assumption = (k: string) => {
    const lv = LIVE_FIELDS[k] ? live(k) : undefined;
    return lv ? (
      <>
        <Input type="number" value={String(lv.value)} disabled />
        <p className="mt-1 text-[11px] text-muted-foreground" title={lv.label}>
          Live ·{" "}
          <a href={lv.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            {lv.source}
          </a>{" "}
          · {lv.asOf}
        </p>
      </>
    ) : (
      <Input type="number" value={String(form[k] ?? "")} onChange={(e) => set(k, Number(e.target.value))} />
    );
  };

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">About you</h2>
        <SaveButton
          busy={save.isPending}
          onSave={() =>
            save.mutate({
              ...form,
              fx_overrides: Object.fromEntries(
                Object.entries(overrides).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]),
              ),
            })
          }
        />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input value={String(form["full_name"] ?? "")} onChange={(e) => set("full_name", e.target.value)} />
        </Field>
        <Field label="Current age">
          <Input type="number" value={String(form["age"] ?? "")} onChange={(e) => set("age", Number(e.target.value))} />
        </Field>
        <Field label="Planned retirement age">
          <Input
            type="number"
            value={String(form["retirement_age"] ?? "")}
            onChange={(e) => set("retirement_age", Number(e.target.value))}
          />
        </Field>
        <Field label="Base currency">
          <Select value={String(form["base_currency"])} onValueChange={(v) => set("base_currency", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Exchange rates (units per $1). Leave blank to use the official rate.</Label>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-4">
            {CURRENCIES.filter((c) => c !== "USD").map((c) => (
              <div key={c}>
                <Input
                  type="number"
                  placeholder={official[c] ? `Official ${Number(official[c].per_usd).toLocaleString()}` : "No official rate"}
                  value={overrides[c] ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, [c]: e.target.value }))}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {c}
                  {official[c] ? ` · as of ${new Date(official[c].as_of).toLocaleDateString("en-GB")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:col-span-2">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Fill economic assumptions from live data</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Inflation, Naira loss, foreign inflation, the inflation ↔ Naira link, what cash earns and school-fee
                inflation come from the CBN, World Bank, US BLS and SEC Nigeria, and update as new figures and
                exchange rates come in. Turn off to use your own numbers.
              </span>
            </span>
            <Switch
              checked={liveOn}
              disabled={toggleLive.isPending}
              onCheckedChange={(v) =>
                toggleLive.mutate(v, {
                  onSuccess: () => toast.success(v ? "Using live data." : "Using your own numbers."),
                  onError: (e) => toast.error(e.message),
                })
              }
            />
          </label>
          {liveOn && market?.fxChange1y && (
            <p className="mt-3 text-xs text-muted-foreground">
              For context: the Naira moved {market.fxChange1y.value > 0 ? "+" : ""}
              {market.fxChange1y.value}% against the dollar in the last 12 months. The Naira-loss figure uses the
              10-year average, which suits a long-term plan better than one year.
            </p>
          )}
        </div>
        <Field label="Expected inflation %/yr">{assumption("inflation_rate")}</Field>
        <Field label="Risk tolerance">
          <Select value={String(form["risk_tolerance"])} onValueChange={(v) => set("risk_tolerance", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative — protect what I have</SelectItem>
              <SelectItem value="balanced">Balanced — steady growth</SelectItem>
              <SelectItem value="growth">Growth — I can take swings</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {(
          [
            ["fx_depreciation", "Naira loss vs $ per year %"],
            ["education_inflation", "School fees inflation %/yr"],
            ["salary_growth", "Salary growth %/yr"],
            ["emergency_fund", "Emergency fund saved"],
            ["life_cover", "Life insurance cover"],
            ["health_cover", "Health insurance cover / yr"],
            ["foreign_inflation", "Foreign (USD/CAD) inflation %/yr"],
            ["inflation_fx_correlation", "Inflation ↔ Naira correlation (−1 to 1)"],
            ["cash_yield_ratio", "Cash earns this share of inflation (0–1.5)"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            {assumption(k)}
          </Field>
        ))}
        <Field label="Investment contributions rise with my salary">
          <Switch checked={form["grow_contributions"] === true} onCheckedChange={(v) => set("grow_contributions", v)} />
        </Field>
        <Field label="Income stability">
          <Select value={String(form["income_stability"])} onValueChange={(v) => set("income_stability", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable salary</SelectItem>
              <SelectItem value="variable">Variable / business / commission</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Every forecast in the app uses these assumptions{liveOn ? ", with live values where shown" : ""}.
        </p>
        <Field label="My goals">
          <Textarea
            className="min-h-24"
            value={String(form["goals"] ?? "")}
            onChange={(e) => set("goals", e.target.value)}
            placeholder="e.g. Buy a house in 5 years, children's university fees, retire comfortably"
          />
        </Field>
      </div>
    </section>
  );
}

/** Profile fields that can come from live market data, and their key in MarketAssumptions. */
const LIVE_FIELDS: Record<string, string> = {
  inflation_rate: "inflation",
  fx_depreciation: "fxDepreciation",
  education_inflation: "educationInflation",
  foreign_inflation: "foreignInflation",
  inflation_fx_correlation: "inflationFxCorrelation",
  cash_yield_ratio: "cashYieldRatio",
};

/* ---------------- generic list sections ---------------- */

interface FieldSpec {
  key: string;
  label: string;
  num?: boolean;
  bool?: boolean;
  area?: boolean;
  select?: string[];
  choices?: [string, string][];
  nullable?: boolean;
  list?: boolean;
}

function Section({
  table,
  userId,
  rows,
  fields,
  defaults,
  title,
  emptyText,
}: {
  table: TableName;
  userId: string;
  rows: Draft[];
  fields: FieldSpec[];
  defaults: Draft;
  title: (r: Draft) => string;
  emptyText: string;
}) {
  const upsert = useUpsertRow(table, userId);
  const del = useDeleteRow(table, userId);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Draft>(defaults);

  const cur = defaults["currency"] as string;

  return (
    <section className="space-y-4">
      {rows.length === 0 && !adding && <p className="text-muted-foreground">{emptyText}</p>}

      {rows.map((row) => (
        <RowCard key={String(row["id"])} row={row} fields={fields} table={table} upsert={upsert} del={del} title={title} />
      ))}

      {adding && (
        <div className="panel space-y-4 border border-dashed p-4">
          <h3 className="font-medium">New entry</h3>
          <FieldGrid fields={fields} form={newRow} set={(k, v) => setNewRow((f) => ({ ...f, [k]: v }))} defaultCurrency={cur} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { upsert.mutate(newRow); setAdding(false); setNewRow(defaults); }} disabled={upsert.isPending}>
              <Save className="size-4" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> Add new
      </Button>
    </section>
  );
}

function RowCard({
  row,
  fields,
  table,
  upsert,
  del,
  title,
}: {
  row: Draft;
  fields: FieldSpec[];
  table: string;
  upsert: ReturnType<typeof useUpsertRow>;
  del: ReturnType<typeof useDeleteRow>;
  title: (r: Draft) => string;
}) {
  const [form, setForm] = useState<Draft>(row);
  const set = (k: string, v: Draft[string]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = fields.some((f) => String(form[f.key] ?? "") !== String(row[f.key] ?? ""));

  return (
    <article className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium">{title(row)}</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => upsert.mutate(form)}
            disabled={!dirty || upsert.isPending}
          >
            <Save className="size-4" /> Save
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(String(row["id"]))} disabled={del.isPending}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <FieldGrid fields={fields} form={form} set={set} defaultCurrency={String(row["currency"] ?? "NGN")} />
      {table === "cash_flows" && null}
    </article>
  );
}

function FieldGrid({
  fields,
  form,
  set,
  defaultCurrency,
}: {
  fields: FieldSpec[];
  form: Draft;
  set: (k: string, v: Draft[string]) => void;
  defaultCurrency: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} {...(f.area ? { className: "sm:col-span-2 lg:col-span-3" } : {})}>
          {f.bool ? (
            <Switch checked={form[f.key] === true} onCheckedChange={(v) => set(f.key, v)} />
          ) : f.select ? (
            <Select value={String(form[f.key] ?? defaultCurrency)} onValueChange={(v) => set(f.key, v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {f.select.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.choices ? (
            <Select value={String(form[f.key] ?? "") || "__none"} onValueChange={(v) => set(f.key, v === "__none" ? null : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {f.choices.map(([v, l]) => (
                  <SelectItem key={v || "__none"} value={v || "__none"}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.list ? (
            <Input
              defaultValue={Array.isArray(form[f.key]) ? (form[f.key] as unknown as number[]).join(", ") : ""}
              onChange={(e) =>
                set(
                  f.key,
                  e.target.value
                    .split(/[ ,]+/)
                    .map(Number)
                    .filter((n) => n >= 1 && n <= 12) as unknown as string,
                )
              }
            />
          ) : f.area ? (
            <Textarea className="min-h-16" value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.num ? (
            <Input type="number" value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, f.nullable && e.target.value === "" ? null : Number(e.target.value))} />
          ) : (
            <Input value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </Field>
      ))}
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SaveButton({ busy, onSave }: { busy: boolean; onSave: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      onClick={() => {
        onSave();
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      disabled={busy}
    >
      <Save className="size-4" /> {done ? "Saved" : "Save"}
    </Button>
  );
}
