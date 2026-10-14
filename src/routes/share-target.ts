import { createFileRoute } from "@tanstack/react-router";

/**
 * Share-target fallback. Normally the service worker answers POST /share-target itself; this only
 * runs on the very first launch, before the worker is in control. Text goes straight to Ask Kudi.
 * A shared file can't be handed to the page from here, so the user is asked to pick it once.
 */
export const Route = createFileRoute("/share-target")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const file = form?.get("statement");
        const base = new URL(request.url).origin;
        if (file && typeof file === "object" && "size" in file && file.size > 0)
          return Response.redirect(`${base}/spending?shared=retry`, 303);
        const text = ["title", "text", "url"]
          .map((k) => form?.get(k))
          .filter((v): v is string => typeof v === "string" && !!v)
          .join("\n")
          .trim();
        return Response.redirect(
          text ? `${base}/advisor?q=${encodeURIComponent(text.slice(0, 2000))}` : `${base}/`,
          303,
        );
      },
      GET: async ({ request }) => Response.redirect(new URL("/", request.url).href, 302),
    },
  },
});
