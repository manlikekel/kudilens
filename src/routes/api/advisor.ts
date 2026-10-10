import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiSummary } from "@/lib/finance";
import { errorResponse, KUDI_TONE, loadData } from "@/lib/ai.server";

const SYSTEM = `${KUDI_TONE}
You are the "Ask Kudi" chat. You receive a compact JSON summary (no household names) with forecasts already computed by the app's finance engine: Monte Carlo net worth percentiles, goal probabilities, debt payoff, emergency fund, health score.
- Answer affordability and what-if questions with real arithmetic from those numbers; show the key calculation briefly.
- When a chart helps, include ONE fenced block in this exact format (labels short, values plain numbers in Naira unless stated):
\`\`\`chart
{"type":"bar","title":"...","data":[{"label":"Now","value":1000000},{"label":"In 1 yr","value":1500000}]}
\`\`\`
  type may be "bar" or "line".
- Use short headings and bullets in markdown. End with 2–3 concrete next steps.`;

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

        let loaded;
        try {
          loaded = await Promise.all([
          loadData(supabase, userId),
          supabase
            .from("advisor_messages")
            .select("role, content")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(40),
          ]);
        } catch (e) {
          return errorResponse(e);
        }
        const [data, history] = loaded;
        if (history.error) return new Response(`Could not load chat history: ${history.error.message}`, { status: 500 });
        const snapshot = aiSummary(data);

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
