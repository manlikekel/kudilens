import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Meaning, Num, compact } from "@/components/kudi";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { callApi } from "@/lib/api";
import { useFinance } from "@/lib/useFinance";
import {
  CATEGORIES, CURRENCIES, applyRules, detectRecurring, formatMoney, monthlySpending, rowsToTxns,
  type CategoryRule, type ColumnMapping, type ParsedTable,
} from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Budgets, SinkingFunds } from "@/components/spending/Budgets";

export const Route = createFileRoute("/spending")({
  head: () => ({
    meta: [
      { title: "Spending & statements — KudiLens" },
      { name: "description", content: "Import bank statements, auto-categorise spending, and spot recurring payments and subscriptions." },
      { property: "og:title", content: "Spending & statements — KudiLens" },
      { property: "og:description", content: "See where your money actually goes, from your own bank statements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <SpendingPage />
    </AppShell>
  ),
});

interface TxnRow {
  id: string; txn_date: string; amount_minor: number; currency: string; merchant: string; description: string | null;
  category: string; is_recurring: boolean; account_id: string | null;
}

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function SpendingPage() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: fin } = useFinance(uid);
  const txQ = useQuery({
    queryKey: ["txns", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("user_id", uid).order("txn_date", { ascending: false }).limit(2000);
      if (error) throw new Error(error.message);
      return data as TxnRow[];
    },
  });
  const rulesQ = useQuery({
    queryKey: ["rules", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("category_rules").select("*").eq("user_id", uid).order("created_at");
      if (error) throw new Error(error.message);
      return data as (CategoryRule & { id: string })[];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["txns", uid] });
    qc.invalidateQueries({ queryKey: ["finance", uid] });
  };
  const txns = txQ.data ?? [];
  const rules = rulesQ.data ?? [];
  const months = useMemo(() => monthlySpending(txns.filter((t) => t.currency === "NGN")), [txns]);
  const recurring = useMemo(() => detectRecurring(txns), [txns]);
  const [tab, setTab] = useState<string | null>(null);
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  // a statement shared to KudiLens from another app (see the share target in sw.js)
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("shared");
    if (!shared) return;
    window.history.replaceState(null, "", "/spending");
    setTab("import");
    if (shared === "retry") {
      toast.message("Choose the statement once more to import it.");
      return;
    }
    void (async () => {
      try {
        const cache = await caches.open("kudilens-share");
        const res = await cache.match("/__shared/statement");
        if (!res) return;
        const name = decodeURIComponent(res.headers.get("X-Filename") ?? "statement.csv");
        setSharedFile(new File([await res.blob()], name, { type: res.headers.get("Content-Type") ?? "" }));
        await cache.delete("/__shared/statement");
      } catch {
        toast.error("Couldn't open the shared file. Please choose it below.");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Spending</h1>
        <p className="text-sm text-muted-foreground">Import statements from GTBank, Access, Zenith, UBA, First Bank, Kuda, Moniepoint, Opay or any bank's CSV/PDF.</p>
      </div>
      <Tabs value={tab ?? (txns.length ? "overview" : "import")} onValueChange={setTab}>
        <TabsList className="no-scrollbar flex h-auto w-full justify-start overflow-x-auto rounded-xl p-1 [&>*]:shrink-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="sinking">Sinking funds</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="transactions">Transactions ({txns.length})</TabsTrigger>
          <TabsTrigger value="recurring">Recurring ({recurring.length})</TabsTrigger>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview months={months} usesActual={!!fin?.actualSpend?.months} /></TabsContent>
        <TabsContent value="budgets">{fin && <Budgets data={fin} txns={txns} uid={uid} />}</TabsContent>
        <TabsContent value="sinking">{fin && <SinkingFunds data={fin} uid={uid} />}</TabsContent>
        <TabsContent value="import">
          <Importer uid={uid} accounts={fin?.accounts ?? []} rules={rules} onDone={refresh} sharedFile={sharedFile} />
        </TabsContent>
        <TabsContent value="transactions"><TxnList txns={txns} uid={uid} rules={rules} onChange={() => { refresh(); qc.invalidateQueries({ queryKey: ["rules", uid] }); }} /></TabsContent>
        <TabsContent value="recurring"><Recurring items={recurring} /></TabsContent>
        <TabsContent value="rules"><Rules uid={uid} rules={rules} txns={txns} onChange={() => { qc.invalidateQueries({ queryKey: ["rules", uid] }); refresh(); }} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Overview({ months, usesActual }: { months: ReturnType<typeof monthlySpending>; usesActual: boolean }) {
  if (!months.length)
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No transactions yet. Import a bank statement so your forecasts use what you really spend, not estimates.</CardContent></Card>;
  const last = months[months.length - 1]!;
  const chart = months.slice(-12).map((m) => ({ month: m.month, spend: m.spendMinor / 100, income: m.incomeMinor / 100 }));
  const cats = Object.entries(last.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Money in vs spending (Naira accounts)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis tickFormatter={(v) => compact(v)} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip formatter={(v: number) => formatMoney(v, "NGN")} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Bar dataKey="income" name="Money in" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spend" name="Spending" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Meaning>
            Each pair of bars is one month. When the spending bar is taller than money in, you dipped into savings that month. Transfers between your own accounts,
            savings and loan repayments aren't counted as spending.
            {usesActual ? " Your 12-month cash forecast now uses these actual figures." : " Once you have a full month imported, your cash forecast will use it."}
          </Meaning>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>{last.month}: where it went</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {cats.map(([c, v]) => (
            <div key={c}>
              <div className="flex justify-between text-sm"><span>{c}</span>
                <Num formula={`Sum of all outgoing ${c} transactions dated ${last.month}.`}>{formatMoney(v / 100, "NGN")}</Num></div>
              <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(v / last.spendMinor) * 100}%` }} /></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Importer({ uid, accounts, rules, onDone, sharedFile }: { uid: string; accounts: { id: string; name: string; currency: string }[]; rules: CategoryRule[]; onDone: () => void; sharedFile?: File | null }) {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [map, setMap] = useState<ColumnMapping | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [currency, setCurrency] = useState("NGN");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    try {
      const isPdf = f.name.toLowerCase().endsWith(".pdf");
      let payload: Record<string, string>;
      if (isPdf) {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        payload = { kind: "pdf", base64: btoa(bin), filename: f.name };
      } else payload = { kind: "csv", text: await f.text() };
      const out = await callApi<ParsedTable & { mapping: ColumnMapping }>("/api/statements", payload);
      setTable(out);
      setMap(out.mapping);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // read a statement shared from another app as if it had been chosen here
  useEffect(() => {
    if (sharedFile) {
      toast.message(`Reading ${sharedFile.name}…`);
      void onFile(sharedFile);
    }
    // onFile is recreated each render; only react to a new shared file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedFile]);

  const preview = useMemo(() => (table && map ? rowsToTxns(table, map, currency, rules) : null), [table, map, currency, rules]);

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      let txns = preview.txns;
      // AI only sees merchant names that the rules couldn't place.
      const unknown = [...new Set(txns.filter((t) => t.category === "Uncategorised").map((t) => t.merchant))];
      if (unknown.length) {
        try {
          const { categories } = await callApi<{ categories: Record<string, string> }>("/api/categorise", { merchants: unknown });
          txns = txns.map((t) => (t.category === "Uncategorised" && categories[t.merchant] ? { ...t, category: categories[t.merchant]! } : t));
        } catch (e) {
          toast.message(`Imported without AI categories: ${(e as Error).message}`);
        }
      }
      const rec = new Set(detectRecurring(txns).map((r) => r.merchant));
      const rows = txns.map((t) => ({
        ...t, user_id: uid, account_id: accountId || null, source: "import",
        is_recurring: rec.has(t.merchant.split(" ").slice(0, 2).join(" ")),
      }));
      let added = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await supabase.from("transactions").upsert(rows.slice(i, i + 500), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
        if (error) throw new Error(error.message);
        added += data?.length ?? 0;
      }
      toast.success(`${added} new transactions imported${rows.length - added ? `, ${rows.length - added} already there (skipped)` : ""}.`);
      setTable(null);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const colSel = (key: keyof ColumnMapping, label: string) => (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select className={sel + " w-full"} value={map![key]} onChange={(e) => setMap({ ...map!, [key]: Number(e.target.value) })}>
        <option value={-1}>— none —</option>
        {table!.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </label>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Import a statement</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" /> {busy ? "Reading…" : "Choose CSV or PDF"}
            <input type="file" accept=".csv,.txt,.pdf" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <select className={sel} value={accountId} onChange={(e) => { setAccountId(e.target.value); const a = accounts.find((x) => x.id === e.target.value); if (a) setCurrency(a.currency); }}>
            <option value="">Which account? (optional)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className={sel} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Re-importing the same statement is safe — rows already saved are skipped. Only merchant names (never amounts) are sent to the AI for categorising.</p>
        {table && map && preview && (
          <>
            <div className="grid gap-3 sm:grid-cols-5">
              {colSel("date", "Date")}{colSel("description", "Description")}{colSel("amount", "Signed amount")}{colSel("debit", "Debit / out")}{colSel("credit", "Credit / in")}
            </div>
            <p className="text-sm">{preview.txns.length} transactions ready{preview.skipped ? `, ${preview.skipped} rows skipped (no date or amount)` : ""}.</p>
            <div className="max-h-80 overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs"><tr><th className="p-2">Date</th><th className="p-2">Merchant</th><th className="p-2">Category</th><th className="p-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {preview.txns.slice(0, 50).map((t) => (
                    <tr key={t.dedupe_key} className="border-t border-border">
                      <td className="p-2">{t.txn_date}</td><td className="p-2">{t.merchant}</td><td className="p-2 text-muted-foreground">{t.category}</td>
                      <td className={"p-2 text-right tabular-nums " + (t.amount_minor < 0 ? "" : "text-success")}>{formatMoney(t.amount_minor / 100, t.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={save} disabled={busy || !preview.txns.length}><Sparkles className="mr-2 h-4 w-4" />Import & auto-categorise</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TxnList({ txns, uid, rules, onChange }: { txns: TxnRow[]; uid: string; rules: CategoryRule[]; onChange: () => void }) {
  const [q, setQ] = useState("");
  const shown = txns.filter((t) => !q || `${t.merchant} ${t.category}`.toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  const setCat = useMutation({
    mutationFn: async ({ t, category, teach }: { t: TxnRow; category: string; teach: boolean }) => {
      const { error } = await supabase.from("transactions").update({ category }).eq("id", t.id);
      if (error) throw new Error(error.message);
      if (teach && !rules.some((r) => r.pattern.toUpperCase() === t.merchant.toUpperCase())) {
        const { error: e2 } = await supabase.from("category_rules").insert({ user_id: uid, pattern: t.merchant, category });
        if (e2) throw new Error(e2.message);
        await supabase.from("transactions").update({ category }).eq("user_id", uid).eq("merchant", t.merchant);
      }
    },
    onSuccess: (_d, v) => { if (v.teach) toast.success(`Got it — "${v.t.merchant}" will always be ${v.category}.`); onChange(); },
    onError: (e) => toast.error(e.message),
  });
  const del = async (id: string) => { const { error } = await supabase.from("transactions").delete().eq("id", id); if (error) toast.error(error.message); else onChange(); };
  if (!txns.length) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Nothing imported yet.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Input placeholder="Search merchant or category" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="text-xs text-muted-foreground">Changing a category teaches a rule for that merchant, applied to all its past and future transactions.</p>
        <div className="divide-y divide-border">
          {shown.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="w-24 text-muted-foreground">{t.txn_date}</span>
              <span className="min-w-0 flex-1 truncate" title={t.description ?? ""}>{t.merchant}{t.is_recurring && <span className="ml-2 rounded bg-muted px-1.5 text-[10px]">recurring</span>}</span>
              <select className={sel} value={t.category} onChange={(e) => setCat.mutate({ t, category: e.target.value, teach: true })}>
                {[...new Set([...CATEGORIES, t.category])].map((c) => <option key={c}>{c}</option>)}
              </select>
              <span className={"w-32 text-right tabular-nums " + (t.amount_minor > 0 ? "text-success" : "")}>{formatMoney(t.amount_minor / 100, t.currency)}</span>
              <Button size="icon" variant="ghost" aria-label="Delete transaction" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Recurring({ items }: { items: ReturnType<typeof detectRecurring> }) {
  if (!items.length) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No repeating payments found yet. Import at least two months of statements.</CardContent></Card>;
  const subsYear = items.filter((i) => i.isSubscription).reduce((t, i) => t + i.annualMinor, 0);
  return (
    <div className="space-y-3">
      <Meaning>
        We look for payments to the same place roughly every month for about the same amount. Subscriptions cost you{" "}
        <Num formula="Sum of (typical monthly amount × 12) for every detected subscription.">{formatMoney(subsYear / 100, "NGN")}</Num> a year.
      </Meaning>
      {items.map((i) => (
        <Card key={i.merchant}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <div>
              <p className="font-medium">{i.merchant}</p>
              <p className="text-xs text-muted-foreground">{i.category} · seen {i.occurrences}× · next around {i.nextDate}</p>
            </div>
            <div className="text-right">
              <p className="tabular-nums">{formatMoney(i.typicalMinor / 100, "NGN")}/mo</p>
              {i.isSubscription && <p className="text-xs text-warning">Still using it? Cancelling saves {formatMoney(i.annualMinor / 100, "NGN", { compact: true })}/yr</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Rules({ uid, rules, txns, onChange }: { uid: string; rules: (CategoryRule & { id: string })[]; txns: TxnRow[]; onChange: () => void }) {
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState<string>("Groceries");
  async function add() {
    if (!pattern.trim()) return;
    void 0;
    const { error } = await supabase.from("category_rules").insert({ user_id: uid, pattern: pattern.trim(), category });
    if (error) { toast.error(error.message); return; }
    // Re-apply to existing transactions that match.
    const all = [...rules, { pattern: pattern.trim(), category }];
    const changed = txns.filter((t) => applyRules(t.merchant, t.description ?? "", t.amount_minor, [{ pattern: pattern.trim(), category }]) === category && t.category !== category && applyRules(t.merchant, t.description ?? "", t.amount_minor, all) === category);
    for (const t of changed) await supabase.from("transactions").update({ category }).eq("id", t.id);
    toast.success(`Rule saved${changed.length ? ` and applied to ${changed.length} transactions` : ""}.`);
    setPattern("");
    onChange();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("category_rules").delete().eq("id", id);
    if (error) toast.error(error.message); else onChange();
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">Teach Kudi: whenever a description contains this text, use this category. Your rules win over the AI.</p>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder='e.g. "SHOPRITE"' value={pattern} onChange={(e) => setPattern(e.target.value)} />
          <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <Button onClick={add}>Add rule</Button>
        </div>
        <div className="divide-y divide-border">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span>Contains "<b>{r.pattern}</b>" → {r.category}</span>
              <Button size="icon" variant="ghost" aria-label="Delete rule" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
