import { createFileRoute } from "@tanstack/react-router";
import { aiSummary } from "@/lib/finance";
import { authed, completeJSON, errorResponse, KUDI_TONE, loadData } from "@/lib/ai.server";

const SYSTEM = `${KUDI_TONE}
Review one investment idea the user is considering against their whole financial picture. Return JSON exactly:
{"verdict":"Strong fit"|"Fit with changes"|"Wait"|"Poor fit","verdict_reasons":[string],"goal_fit":string,
"returns":{"pessimistic":string,"realistic":string,"optimistic":string},"risk_level":"Low"|"Medium"|"High"|"Very high",
"liquidity":string,"share_of_net_worth":string,"health_score_impact":string,"goal_impact":string,
"key_risks":[string],"questions":[string],"position_size":string,"summary":string}
Be realistic about Nigerian context (inflation, Naira depreciation, execution risk for businesses like farms, title/C of O for land). Returns are % per year in Naira terms with a short note.`;

export const Route = createFileRoute("/api/ideas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authed(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;
        const body = (await request.json().catch(() => null)) as { id?: string } | null;
        if (!body?.id) return new Response("Idea id required", { status: 400 });
        try {
          const { data: idea, error } = await supabase.from("investment_ideas").select("*").eq("id", body.id).maybeSingle();
          if (error || !idea) return new Response("Idea not found", { status: 404 });
          const data = await loadData(supabase, userId);
          const review = await completeJSON<Record<string, unknown>>(
            SYSTEM,
            `Financial summary:\n${JSON.stringify(aiSummary(data))}\n\nIdea: ${idea.title}\nAmount: ${idea.amount} ${idea.currency}\nNotes: ${idea.notes ?? "none"}`,
          );
          const { error: upErr } = await supabase
            .from("investment_ideas")
            .update({ review: review as never, reviewed_at: new Date().toISOString() })
            .eq("id", idea.id);
          if (upErr) throw new Error(upErr.message);
          return Response.json(review);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
