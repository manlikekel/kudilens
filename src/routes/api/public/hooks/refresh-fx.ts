import { createFileRoute } from "@tanstack/react-router";
import { CURRENCIES } from "@/lib/finance/fx";

/**
 * Daily job: pulls official USD-based rates from a free public API and stores them in fx_rates.
 * Called by the scheduler with the project's publishable key; it only refreshes public market
 * data, is idempotent, and skips work if rates were refreshed in the last 6 hours.
 */
export const Route = createFileRoute("/api/public/hooks/refresh-fx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: latest } = await supabaseAdmin.from("fx_rates").select("as_of").eq("source", "official").order("as_of", { ascending: false }).limit(1).maybeSingle();
        if (latest && Date.now() - new Date(latest.as_of).getTime() < 6 * 3600 * 1000) {
          return Response.json({ skipped: true, as_of: latest.as_of });
        }

        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`FX API failed [${res.status}]: ${text}`);
          return new Response(`FX provider error ${res.status}`, { status: 502 });
        }
        const body = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
        if (body.result !== "success" || !body.rates) return new Response("FX provider returned no rates", { status: 502 });
        const asOf = new Date((body.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString();
        const rows = CURRENCIES.filter((c) => (body.rates?.[c] ?? 0) > 0).map((c) => ({
          currency: c,
          per_usd: body.rates![c]!,
          as_of: asOf,
          source: "official",
        }));
        const { error } = await supabaseAdmin.from("fx_rates").upsert(rows, { onConflict: "currency" });
        if (error) return new Response(`Could not save rates: ${error.message}`, { status: 500 });
        return Response.json({ updated: rows.length, as_of: asOf });
      },
    },
  },
});
