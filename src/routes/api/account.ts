import { createFileRoute } from "@tanstack/react-router";
import { authed } from "@/lib/ai.server";
import { USER_TABLES } from "@/lib/account";

/**
 * DELETE: permanently deletes the signed-in user's data and login. Rows are removed with the
 * user's own token (row-level security limits it to their rows), then the login itself is
 * removed with the service role.
 */
export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const auth = await authed(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;
        for (const { table, owner } of USER_TABLES) {
          const { error } = await supabase
            .from(table as never)
            .delete()
            .eq(owner as never, userId as never);
          // a table that doesn't exist yet in this project shouldn't block deletion
          if (error && !/does not exist|schema cache/i.test(error.message)) {
            console.error(`Account deletion failed on ${table}`, error);
            return new Response(`Could not delete ${table}: ${error.message}`, { status: 500 });
          }
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error)
          return new Response(
            `Data deleted, but the login could not be removed: ${error.message}`,
            { status: 500 },
          );
        return Response.json({ deleted: true });
      },
    },
  },
});
