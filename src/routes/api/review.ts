import { createFileRoute } from "@tanstack/react-router";
import { aiSummary, monthlySpending, summarize } from "@/lib/finance";
import { authed, completeJSON, errorResponse, KUDI_TONE, loadData } from "@/lib/ai.server";

const SYSTEM = `${KUDI_TONE}
Write the user's monthly financial review. Return JSON:
{"headline":string,"last_month":string,"net_worth_change":string,"why":string,"wins":[string],"warnings":[string],
"moves":[{"title":string,"detail":string,"impact":string}]}
"moves" must be exactly the 3 most valuable actions for this month. If there is no previous review, treat this as a baseline month and say so.`;

export const Route = createFileRoute("/api/review")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authed(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;
        try {
          const now = new Date();
          const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const data = await loadData(supabase, userId, auth.live);
          const { data: prev } = await supabase
            .from("monthly_reviews")
            .select("period, net_worth, report")
            .eq("user_id", userId)
            .neq("period", period)
            .order("period", { ascending: false })
            .limit(1)
            .maybeSingle();
          const netWorth = summarize(data).netWorth;
          const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
          const { data: lastTx } = await supabase
            .from("transactions")
            .select("txn_date, amount_minor, category")
            .eq("user_id", userId)
            .gte("txn_date", lastStart)
            .lt("txn_date", `${period}-01`);
          const lastMonth = monthlySpending(lastTx ?? [])[0];
          const actual = lastMonth
            ? `Actual spending last month from bank statements (NGN, by category): ${JSON.stringify(Object.fromEntries(Object.entries(lastMonth.byCategory).map(([k, v]) => [k, Math.round(Number(v) / 100)])))}; money in ${Math.round(lastMonth.incomeMinor / 100)}. Use these actuals rather than estimates for "last_month".`
            : "No bank statement imported for last month; base last_month on estimates and say so.";
          const report = await completeJSON<Record<string, unknown>>(
            SYSTEM,
            `Financial summary now:\n${JSON.stringify(aiSummary(data))}\n\n${actual}\n\nPrevious review (${prev?.period ?? "none"}): net worth ${prev?.net_worth ?? "unknown"}; moves suggested: ${JSON.stringify((prev?.report as { moves?: unknown } | null)?.moves ?? [])}`,
          );
          const { error } = await supabase
            .from("monthly_reviews")
            .upsert({ user_id: userId, period, report: report as never, net_worth: netWorth }, { onConflict: "user_id,period" });
          if (error) throw new Error(error.message);
          return Response.json({ period });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
