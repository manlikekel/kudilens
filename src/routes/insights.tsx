import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { callApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Disclaimer } from "@/components/kudi";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — KudiLens" },
      { name: "description", content: "Weekly AI insights on overspending, idle cash, debts, goals and lifestyle creep." },
      { property: "og:title", content: "Insights — KudiLens" },
      { property: "og:description", content: "Your weekly money findings with concrete actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <InsightsPage />
    </AppShell>
  ),
});

const WEEK = 7 * 24 * 3600 * 1000;
const sevStyle: Record<string, string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/40",
  watch: "bg-warning/15 text-warning border-warning/40",
  opportunity: "bg-primary/15 text-primary border-primary/40",
};

function InsightsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["insights", user?.id];
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_insights").select("*").order("created_at", { ascending: false }).limit(60);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const gen = useMutation({
    mutationFn: () => callApi("/api/insights"),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const mark = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch = status === "snoozed" ? { status, snoozed_until: new Date(Date.now() + WEEK).toISOString() } : { status };
      const { error } = await supabase.from("ai_insights").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Weekly auto-generation: run once if the latest batch is older than 7 days.
  const tried = useRef(false);
  useEffect(() => {
    if (!q.data || tried.current || gen.isPending) return;
    const latest = q.data[0]?.batch_at ? new Date(q.data[0].batch_at).getTime() : 0;
    if (Date.now() - latest > WEEK) {
      tried.current = true;
      gen.mutate();
    }
  }, [q.data, gen]);

  const now = Date.now();
  const active = (q.data ?? []).filter(
    (i) => i.status === "new" || (i.status === "snoozed" && i.snoozed_until && new Date(i.snoozed_until).getTime() < now),
  );
  const order = { urgent: 0, watch: 1, opportunity: 2 } as Record<string, number>;
  active.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Insights</h1>
          <p className="text-sm text-muted-foreground">Fresh findings every week. Your feedback teaches Kudi what matters to you.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
          <RefreshCw className={`size-4 ${gen.isPending ? "animate-spin" : ""}`} /> {gen.isPending ? "Analysing…" : "Refresh"}
        </Button>
      </div>
      {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!q.isLoading && active.length === 0 && !gen.isPending && (
        <p className="text-muted-foreground">You're all caught up. New insights arrive weekly, or tap Refresh.</p>
      )}
      {gen.isPending && active.length === 0 && <p className="animate-pulse text-muted-foreground">Kudi is reading your numbers…</p>}
      <div className="space-y-3">
        {active.map((i) => (
          <article key={i.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{i.title}</h3>
              <Badge variant="outline" className={sevStyle[i.severity] ?? ""}>{i.severity}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{i.finding}</p>
            {i.metric && <p className="numeric mt-2 text-lg font-semibold">{i.metric}</p>}
            {i.action && (
              <p className="mt-2 text-sm">
                <span className="font-medium">Do this: </span>
                {i.action}
                {i.impact && <span className="ml-1 text-primary">({i.impact})</span>}
              </p>
            )}
            <div className="mt-3 flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: i.id, status: "done" })}><Check className="size-4" /> Done</Button>
              <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: i.id, status: "snoozed" })}><Clock className="size-4" /> Snooze a week</Button>
              <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: i.id, status: "not_relevant" })}><X className="size-4" /> Not relevant</Button>
            </div>
          </article>
        ))}
      </div>
      <Disclaimer />
    </div>
  );
}
