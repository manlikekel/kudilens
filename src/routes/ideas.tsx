import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Plus, Sparkles as _unused, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { callApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Disclaimer, compact } from "@/components/kudi";

void _unused;

export const Route = createFileRoute("/ideas")({
  head: () => ({
    meta: [
      { title: "My Ideas — investment idea reviewer | KudiLens" },
      { name: "description", content: "Log investment ideas and get an honest, structured review against your goals, risk and net worth." },
      { property: "og:title", content: "My Ideas — investment idea reviewer | KudiLens" },
      { property: "og:description", content: "Should you do that poultry farm, land or Eurobond? Get a verdict with reasons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <IdeasPage />
    </AppShell>
  ),
});

interface Review {
  verdict?: string;
  verdict_reasons?: string[];
  goal_fit?: string;
  returns?: { pessimistic?: string; realistic?: string; optimistic?: string };
  risk_level?: string;
  liquidity?: string;
  share_of_net_worth?: string;
  health_score_impact?: string;
  goal_impact?: string;
  key_risks?: string[];
  questions?: string[];
  position_size?: string;
  summary?: string;
}

const verdictStyle: Record<string, string> = {
  "Strong fit": "bg-primary/15 text-primary border-primary/40",
  "Fit with changes": "bg-chart-2/15 border-border",
  Wait: "bg-warning/15 text-warning border-warning/40",
  "Poor fit": "bg-destructive/15 text-destructive border-destructive/40",
};

function IdeasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["ideas", user?.id];
  const [form, setForm] = useState({ title: "", amount: 0, currency: "NGN", notes: "" });
  const [compare, setCompare] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("investment_ideas").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const review = async (id: string) => {
    setReviewing(id);
    try {
      await callApi("/api/ideas", { id });
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReviewing(null);
    }
  };
  const add = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("investment_ideas")
        .insert({ ...form, user_id: user!.id, notes: form.notes || null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: async (id) => {
      setForm({ title: "", amount: 0, currency: "NGN", notes: "" });
      await qc.invalidateQueries({ queryKey: key });
      void review(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investment_ideas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const ideas = q.data ?? [];
  const chosen = ideas.filter((i) => compare.includes(i.id) && i.review);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My Ideas</h1>
        <p className="text-sm text-muted-foreground">Log an idea you're considering. Kudi checks it against your goals, risk and net worth.</p>
      </div>

      <form
        className="panel grid gap-3 p-4 sm:grid-cols-[2fr_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.title.trim()) add.mutate();
        }}
      >
        <Input placeholder="e.g. Poultry farm, Buy land in Lugbe, Dollar Eurobond fund" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input type="number" placeholder="Amount" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        <select className="rounded-md border border-input bg-transparent px-3 text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
          <option value="NGN">NGN</option>
          <option value="USD">USD</option>
        </select>
        <Button type="submit" disabled={add.isPending}><Plus className="size-4" /> Review idea</Button>
        <Textarea className="sm:col-span-4" placeholder="Anything else? (location, who's running it, expected returns you were told…)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </form>

      {chosen.length >= 2 && <Compare ideas={chosen} />}
      {compare.length > 0 && chosen.length < 2 && <p className="text-xs text-muted-foreground">Tick 2 or 3 reviewed ideas to compare them side by side.</p>}

      {ideas.length === 0 && !q.isLoading && (
        <div className="panel p-8 text-center text-muted-foreground">
          <Lightbulb className="mx-auto size-8 text-primary" />
          <p className="mt-2">No ideas yet. Try “Put ₦2m in NGX bank stocks”.</p>
        </div>
      )}

      <div className="space-y-4">
        {ideas.map((idea) => {
          const r = idea.review as Review | null;
          return (
            <article key={idea.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {r && (
                    <Checkbox
                      checked={compare.includes(idea.id)}
                      onCheckedChange={(v) =>
                        setCompare((c) => (v ? (c.length >= 3 ? c : [...c, idea.id]) : c.filter((x) => x !== idea.id)))
                      }
                      aria-label="Compare"
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{idea.title}</h3>
                    <p className="numeric text-sm text-muted-foreground">{compact(Number(idea.amount), idea.currency)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r?.verdict && <Badge variant="outline" className={verdictStyle[r.verdict] ?? ""}>{r.verdict}</Badge>}
                  <Button size="sm" variant="outline" onClick={() => review(idea.id)} disabled={reviewing === idea.id}>
                    {reviewing === idea.id ? "Reviewing…" : r ? "Re-review" : "Review"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(idea.id)} aria-label="Delete idea">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {reviewing === idea.id && !r && <p className="mt-3 animate-pulse text-sm text-muted-foreground">Kudi is weighing this against your finances…</p>}
              {r && <ReviewCard r={r} />}
            </article>
          );
        })}
      </div>
      <Disclaimer />
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

function ReviewCard({ r }: { r: Review }) {
  return (
    <div className="mt-4 space-y-4">
      {r.summary && <p className="text-sm">{r.summary}</p>}
      <List title="Why this verdict" items={r.verdict_reasons} />
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Pessimistic return" value={r.returns?.pessimistic} />
        <Stat label="Realistic return" value={r.returns?.realistic} />
        <Stat label="Optimistic return" value={r.returns?.optimistic} />
        <Stat label="Risk" value={r.risk_level} />
        <Stat label="Liquidity" value={r.liquidity} />
        <Stat label="Share of net worth" value={r.share_of_net_worth} />
        <Stat label="Fit with goals" value={r.goal_fit} />
        <Stat label="Health Score impact" value={r.health_score_impact} />
        <Stat label="Goal probabilities" value={r.goal_impact} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Key risks" items={r.key_risks} />
        <List title="Answer these before committing" items={r.questions} />
      </div>
      {r.position_size && (
        <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
          <span className="font-medium">Suggested position size: </span>{r.position_size}
        </p>
      )}
    </div>
  );
}

function Compare({ ideas }: { ideas: { id: string; title: string; review: unknown }[] }) {
  const rows: [string, (r: Review) => string | undefined][] = [
    ["Verdict", (r) => r.verdict],
    ["Realistic return", (r) => r.returns?.realistic],
    ["Risk", (r) => r.risk_level],
    ["Liquidity", (r) => r.liquidity],
    ["Share of net worth", (r) => r.share_of_net_worth],
    ["Goal fit", (r) => r.goal_fit],
    ["Position size", (r) => r.position_size],
  ];
  return (
    <section className="panel overflow-x-auto p-4">
      <h2 className="mb-3 font-semibold">Side by side</h2>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th />
            {ideas.map((i) => <th key={i.id} className="p-2 text-left font-medium">{i.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get]) => (
            <tr key={label} className="border-t border-border align-top">
              <td className="p-2 text-muted-foreground">{label}</td>
              {ideas.map((i) => <td key={i.id} className="p-2">{get(i.review as Review) ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
