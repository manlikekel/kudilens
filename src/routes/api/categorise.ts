import { createFileRoute } from "@tanstack/react-router";
import { CATEGORIES } from "@/lib/finance";
import { authed, completeJSON, errorResponse } from "@/lib/ai.server";

/** Categorises uncategorised merchant names. Only merchant names are sent — never amounts or account details. */
export const Route = createFileRoute("/api/categorise")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authed(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        try {
          const { merchants } = (await request.json()) as { merchants: string[] };
          const list = [...new Set((merchants ?? []).map((m) => String(m).slice(0, 60)))].slice(0, 150);
          if (!list.length) return Response.json({ categories: {} });
          const out = await completeJSON<{ categories: Record<string, string> }>(
            `You categorise Nigerian bank-statement merchants. Allowed categories: ${CATEGORIES.join(", ")}. Return JSON {"categories":{"MERCHANT":"Category"}}. Use "Uncategorised" when unsure.`,
            list.join("\n"),
          );
          const allowed = new Set<string>(CATEGORIES);
          const categories = Object.fromEntries(Object.entries(out.categories ?? {}).filter(([, c]) => allowed.has(c)));
          return Response.json({ categories });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
