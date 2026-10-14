import { createFileRoute } from "@tanstack/react-router";
import { latestSecReport } from "@/lib/invest/sec.server";

/** Every Nigerian collective investment scheme from the latest SEC weekly report. */
export const Route = createFileRoute("/api/ng-funds")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const report = await latestSecReport();
          return Response.json(report, { headers: { "Cache-Control": "public, max-age=3600" } });
        } catch (err) {
          console.error("SEC report failed", err);
          return new Response(err instanceof Error ? err.message : "SEC report unavailable", {
            status: 502,
          });
        }
      },
    },
  },
});
