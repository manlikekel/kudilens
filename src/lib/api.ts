import { supabase } from "@/integrations/supabase/client";

/** POST to an app API route with the signed-in user's token; throws with the server's message. */
export async function callApi<T = unknown>(path: string, body: unknown = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
  return (await res.json()) as T;
}
