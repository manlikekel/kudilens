import { createFileRoute } from "@tanstack/react-router";
import { aiSummary } from "@/lib/finance";
import { authed, completeJSON, errorResponse, KUDI_TONE, loadData } from "@/lib/ai.server";

interface Out {
  insights: { kind: string; title: string; finding: string; metric: string; severity: string; action: string; impact: string }[];
}

const SYSTEM = `${KUDI_TONE}
Generate this week's insights feed. Return JSON: {"insights":[{"kind","title","finding","metric","severity","action","impact"}]}.
- 4 to 7 insights. kind is one of: overspending, idle_cash, maturity, concentration, debt_vs_return, goal_drift, lifestyle_creep, other.
- finding: 1–2 sentences. metric: the single number behind it (e.g. "₦2.4m idle at 3%"). severity: opportunity | watch | urgent.
- action: one concrete step. impact: estimated effect (e.g. "+₦180k/yr", "goal reached 7 months earlier").
- Respect the user's feedback: do not repeat insights marked not_relevant; avoid re-raising "done" items unless the numbers changed; you may resurface snoozed ones only if more urgent.`;

export const Route = createFileRoute("/api/insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authed(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;
        try {
          const data = await loadData(supabase, userId, auth.live);
          const { data: past } = await supabase
            .from("ai_insights")
            .select("kind, title, status")
            .eq("user_id", userId)
            .neq("status", "new")
            .order("created_at", { ascending: false })
            .limit(40);
          const out = await completeJSON<Out>(
            SYSTEM,
            `Financial summary:\n${JSON.stringify(aiSummary(data))}\n\nUser feedback on past insights:\n${JSON.stringify(past ?? [])}`,
          );
          const batch = new Date().toISOString();
          const sev = new Set(["opportunity", "watch", "urgent"]);
          const rows = (out.insights ?? []).slice(0, 8).map((i) => ({
            user_id: userId,
            batch_at: batch,
            kind: String(i.kind ?? "other"),
            title: String(i.title ?? "Insight").slice(0, 200),
            finding: String(i.finding ?? ""),
            metric: i.metric ? String(i.metric) : null,
            severity: sev.has(i.severity) ? i.severity : "watch",
            action: i.action ? String(i.action) : null,
            impact: i.impact ? String(i.impact) : null,
          }));
          // Retire previous unread items, keep feedback history.
          await supabase.from("ai_insights").update({ status: "expired" }).eq("user_id", userId).eq("status", "new");
          const { error } = await supabase.from("ai_insights").insert(rows);
          if (error) throw new Error(error.message);
          return Response.json({ count: rows.length });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
