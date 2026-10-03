import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { callApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Disclaimer, compact } from "@/components/kudi";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Monthly review — KudiLens" },
      { name: "description", content: "Your monthly financial review: what happened, net worth change, wins, warnings and the 3 best moves." },
      { property: "og:title", content: "Monthly review — KudiLens" },
      { property: "og:description", content: "A clear monthly report on your money, exportable as PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ReviewPage />
    </AppShell>
  ),
});

interface Report {
  headline?: string;
  last_month?: string;
  net_worth_change?: string;
  why?: string;
  wins?: string[];
  warnings?: string[];
  moves?: { title: string; detail: string; impact?: string }[];
}

const periodNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const label = (p: string) => new Date(`${p}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

function ReviewPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["reviews", user?.id];
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_reviews").select("*").order("period", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const gen = useMutation({
    mutationFn: () => callApi("/api/review"),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  // Auto-generate the review for the new month on first visit after the 1st.
  const tried = useRef(false);
  useEffect(() => {
    if (!q.data || tried.current) return;
    if (!q.data.some((r) => r.period === periodNow())) {
      tried.current = true;
      gen.mutate();
    }
  }, [q.data, gen]);

  const reviews = q.data ?? [];
  const current = reviews.find((r) => r.period === sel) ?? reviews[0];
  const r = (current?.report ?? {}) as Report;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold">Monthly review</h1>
          <p className="text-sm text-muted-foreground">A new report is prepared at the start of every month.</p>
        </div>
        <div className="flex gap-2">
          {reviews.length > 1 && (
            <select className="rounded-md border border-input bg-transparent px-2 text-sm" value={current?.period} onChange={(e) => setSel(e.target.value)}>
              {reviews.map((x) => <option key={x.period} value={x.period}>{label(x.period)}</option>)}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
            <RefreshCw className={`size-4 ${gen.isPending ? "animate-spin" : ""}`} /> Regenerate
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!current}>
            <Download className="size-4" /> PDF
          </Button>
        </div>
      </div>

      {!current && (gen.isPending ? <p className="animate-pulse text-muted-foreground">Kudi is writing this month's review…</p> : <p className="text-muted-foreground">No review yet.</p>)}

      {current && (
        <article id="report" className="panel space-y-6 p-6 print:border-0 print:shadow-none">
          <header className="border-b border-border pb-4">
            <p className="font-display text-sm text-primary">KudiLens · {label(current.period)}</p>
            <h2 className="mt-1 text-2xl font-semibold">{r.headline ?? "Your monthly review"}</h2>
            {current.net_worth != null && <p className="numeric mt-1 text-muted-foreground">Net worth: {compact(Number(current.net_worth))}</p>}
          </header>
          {r.last_month && <Sec title="What happened">{r.last_month}</Sec>}
          {(r.net_worth_change || r.why) && (
            <Sec title="Net worth change">
              <span className="font-medium">{r.net_worth_change}</span> {r.why}
            </Sec>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {!!r.wins?.length && (
              <div className="rounded-lg bg-primary/10 p-4">
                <p className="font-medium text-primary">Wins</p>
                <ul className="mt-1 list-disc pl-5 text-sm">{r.wins.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            {!!r.warnings?.length && (
              <div className="rounded-lg bg-warning/10 p-4">
                <p className="font-medium text-warning">Warnings</p>
                <ul className="mt-1 list-disc pl-5 text-sm">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
          </div>
          {!!r.moves?.length && (
            <div>
              <p className="mb-2 font-semibold">3 most valuable moves this month</p>
              <ol className="space-y-2">
                {r.moves.slice(0, 3).map((m, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-border p-3">
                    <span className="numeric text-xl font-semibold text-primary">{i + 1}</span>
                    <div className="text-sm">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-muted-foreground">{m.detail}</p>
                      {m.impact && <p className="text-primary">{m.impact}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <Disclaimer />
        </article>
      )}
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </section>
  );
}
