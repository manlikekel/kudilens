import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { USER_TABLES } from "@/lib/account";
import { removeLock } from "@/lib/applock";

/** Download everything as JSON, or permanently delete the account. */
export function DataSettings({ email }: { email: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  async function download() {
    setBusy(true);
    try {
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email };
      for (const { table } of USER_TABLES) {
        const { data, error } = await supabase.from(table as never).select("*");
        out[table] = error ? { error: error.message } : data;
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kudilens-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error(await res.text());
      removeLock();
      await supabase.auth.signOut();
      toast.success("Your account and data have been deleted.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Your data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Download a copy of everything KudiLens holds about you, or delete your account. See the{" "}
        <a href="/privacy" className="text-primary underline">
          privacy policy
        </a>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={download} disabled={busy}>
          Download my data
        </Button>
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          Delete my account
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your login and all your numbers, goals, statements and
              advisor history. It can't be undone. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTyped("")}>Keep my account</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={typed !== "DELETE" || busy}
              onClick={async () => {
                await deleteAccount();
                setConfirmOpen(false);
              }}
            >
              {busy ? "Deleting…" : "Delete forever"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
