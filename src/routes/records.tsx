import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useFinance, useUpsertRow, useDeleteRow, useSaveProfile } from "@/lib/useFinance";
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
      { title: "My numbers — LedgerIQ" },
      {
        name: "description",
        content: "Enter your profile, family, income, spending, debts and investments for analysis.",
      },
      { property: "og:title", content: "My numbers — LedgerIQ" },
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

const CURRENCIES = ["NGN", "USD"];

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
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="family">Family</TabsTrigger>
          <TabsTrigger value="flows">Income &amp; spending</TabsTrigger>
          <TabsTrigger value="debts">Debts</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection data={data} />
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
                select: ["stocks", "bonds", "real estate", "cash", "crypto", "pension", "business", "other"],
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
    usd_ngn_rate: p?.usd_ngn_rate ?? 1500,
    inflation_rate: p?.inflation_rate ?? 25,
    risk_tolerance: p?.risk_tolerance ?? "balanced",
    goals: p?.goals ?? "",
  });
  const set = (k: string, v: Draft[string]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">About you</h2>
        <SaveButton busy={save.isPending} onSave={() => save.mutate(form)} />
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
                  {c === "USD" ? "USD — US dollar" : "NGN — Naira"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Exchange rate (₦ per $1)">
          <Input
            type="number"
            value={String(form["usd_ngn_rate"] ?? "")}
            onChange={(e) => set("usd_ngn_rate", Number(e.target.value))}
          />
        </Field>
        <Field label="Expected inflation %/yr">
          <Input
            type="number"
            value={String(form["inflation_rate"] ?? "")}
            onChange={(e) => set("inflation_rate", Number(e.target.value))}
          />
        </Field>
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

/* ---------------- generic list sections ---------------- */

interface FieldSpec {
  key: string;
  label: string;
  num?: boolean;
  bool?: boolean;
  area?: boolean;
  select?: string[];
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
  table: "debts" | "investments" | "cash_flows" | "family_members";
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
          ) : f.area ? (
            <Textarea className="min-h-16" value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.num ? (
            <Input type="number" value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, Number(e.target.value))} />
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
