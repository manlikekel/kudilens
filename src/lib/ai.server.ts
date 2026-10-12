import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { actualSpendNGN, type FinanceData } from "@/lib/finance";

export const KUDI_TONE = `You are Kudi, the analyst inside KudiLens, a personal-finance app for a salaried professional in Nigeria with money in NGN and USD.
Tone: direct and warm, like a smart friend who happens to be a financial analyst. Explain any jargon in plain words the first time you use it.
Ground every claim in the user's numbers (₦ / $). Never invent data. Never recommend specific branded products; you give education, not licensed advice.`;

export async function authed(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

export type Sb = NonNullable<Awaited<ReturnType<typeof authed>>>["supabase"];

/**
 * Loads the user's data under RLS. Errors are surfaced (thrown), not swallowed.
 * Household member names are never selected, so they cannot reach the model.
 */
export async function loadData(supabase: Sb, userId: string): Promise<FinanceData> {
  const results = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("debts").select("*").eq("user_id", userId),
    supabase.from("investments").select("*").eq("user_id", userId),
    supabase.from("cash_flows").select("*").eq("user_id", userId),
    supabase.from("family_members").select("id, relationship, age, dependent, monthly_cost, currency").eq("user_id", userId),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("lump_costs").select("*").eq("user_id", userId),
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase.from("assets").select("*").eq("user_id", userId),
    supabase.from("fx_rates").select("*"),
    supabase.from("transactions").select("txn_date, amount_minor, category, currency").eq("user_id", userId).gte("txn_date", new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("loadData failed", failed.error);
    throw new AIError(500, `Could not load your data: ${failed.error.message}`);
  }
  const [profile, debts, investments, flows, family, goals, lumps, accounts, assets, fx, txns] = results.map((r) => r.data);
  return {
    profile,
    debts: debts ?? [],
    investments: investments ?? [],
    flows: flows ?? [],
    family: ((family as unknown[]) ?? []).map((m) => ({ ...(m as object), name: "" })),
    goals: goals ?? [],
    lumps: lumps ?? [],
    accounts: accounts ?? [],
    assets: assets ?? [],
    fxRates: fx ?? [],
    actualSpend: actualSpendNGN((txns ?? []) as never[], (fx ?? []) as never[], ((profile as { fx_overrides?: Record<string, unknown> } | null)?.fx_overrides) ?? {}),
  } as unknown as FinanceData;
}

export class AIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Streams a chat completion from the Lovable AI Gateway; returns the raw upstream response. */
export async function streamChat(messages: { role: string; content: string }[], json = false) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AIError(500, "AI is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      stream: true,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error(`AI gateway failed [${res.status}]: ${text}`);
    const msg =
      res.status === 402
        ? "AI credits are used up. Add credits in workspace settings."
        : res.status === 429
          ? "Too many requests right now — please try again in a minute."
          : `AI unavailable (${res.status}). ${text.slice(0, 200)}`;
    throw new AIError(res.status || 500, msg);
  }
  return res.body;
}

/** Iterates text deltas from an SSE chat-completions stream. */
export async function* deltas(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const d = (JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
        if (d) yield d;
      } catch {
        /* partial */
      }
    }
  }
}

export async function completeJSON<T>(system: string, user: string): Promise<T> {
  const body = await streamChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    true,
  );
  let text = "";
  for await (const d of deltas(body)) text += d;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new AIError(502, "The AI returned an empty answer. Please try again.");
  return JSON.parse(match[0]) as T;
}

export function errorResponse(e: unknown) {
  if (e instanceof AIError) return new Response(e.message, { status: e.status });
  console.error(e);
  return new Response(e instanceof Error ? e.message : "Something went wrong", { status: 500 });
}
