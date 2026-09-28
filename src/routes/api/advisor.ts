import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildInsights, summarize, project, type FinanceData } from "@/lib/finance";

const SYSTEM = `You are LedgerIQ, a sharp personal-finance data scientist for a user in Nigeria who holds money in NGN and USD.
You receive the user's full financial snapshot as JSON (profile, family, income/spending, debts, investments), computed summary metrics, rule-based insights, and a 25-year projection.
- Ground every claim in their numbers; quote figures with currency symbols (₦ or $).
- Give predictive, quantified insight: payoff timelines, projected balances, "if you change X, Y happens".
- Prioritise: cash-flow deficits, expensive debt, emergency buffer, children's education, FX/inflation risk, diversification, retirement.
- Critique their investment ideas honestly (risk, return vs. debt cost, liquidity, currency).
- Be concise, use short headings and bullet points in markdown. End with 2-3 concrete next actions.
- You are not a licensed adviser; say so briefly only when recommending specific products.`;

export const Route = createFileRoute("/api/advisor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
        const message = typeof body?.message === "string" ? body.message.trim().slice(0, 4000) : "";
        if (!message) return new Response("Message required", { status: 400 });

        const [profile, debts, investments, flows, family, history] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase.from("debts").select("*").eq("user_id", userId),
          supabase.from("investments").select("*").eq("user_id", userId),
          supabase.from("cash_flows").select("*").eq("user_id", userId),
          supabase.from("family_members").select("*").eq("user_id", userId),
          supabase
            .from("advisor_messages")
            .select("role, content")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(40),
        ]);

        const data = {
          profile: profile.data,
          debts: debts.data ?? [],
          investments: investments.data ?? [],
          flows: flows.data ?? [],
          family: family.data ?? [],
        } as unknown as FinanceData;

        const snapshot = {
          data,
          summary: summarize(data),
          insights: buildInsights(data),
          projection: project(data, 25).filter((_, i) => i % 5 === 0),
        };

        const { error: insErr } = await supabase
          .from("advisor_messages")
          .insert({ user_id: userId, role: "user", content: message });
        if (insErr) return new Response(`Could not save message: ${insErr.message}`, { status: 500 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            reasoning_effort: "low",
            stream: true,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "system", content: `User financial snapshot:\n${JSON.stringify(snapshot)}` },
              ...(history.data ?? []).map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: message },
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const friendly =
            upstream.status === 402
              ? "AI credits are used up. Add credits in workspace settings."
              : upstream.status === 429
                ? "Too many requests right now — please try again in a minute."
                : `Advisor unavailable (${upstream.status}). ${text.slice(0, 200)}`;
          return new Response(friendly, { status: upstream.status || 500 });
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let full = "";
        let buffer = "";

        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              if (full.trim()) {
                await supabase
                  .from("advisor_messages")
                  .insert({ user_id: userId, role: "assistant", content: full });
              }
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[];
                };
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  full += delta;
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // partial line; ignore
              }
            }
          },
          cancel() {
            void reader.cancel();
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
