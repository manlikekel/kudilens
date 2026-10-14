import { createFileRoute } from "@tanstack/react-router";
import { marketAssumptions } from "@/lib/market.server";

/** Live economic assumptions (inflation, Naira loss, etc.) from public sources. */
export const Route = createFileRoute("/api/market")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(await marketAssumptions(), {
          headers: { "Cache-Control": "public, max-age=3600" },
        }),
    },
  },
});
