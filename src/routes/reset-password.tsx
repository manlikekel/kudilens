import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ResetWithCode } from "@/components/AuthCodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordHints, PasswordInput, passwordOk } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — KudiLens" }] }),
  component: ResetPassword,
});

/**
 * Where the reset email's link lands. The link signs the user in for a recovery session, so we
 * only need the new password. Without a session (link expired, or opened on another device) the
 * code flow is offered instead.
 */
function ResetPassword() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk(password)) {
      toast.error("Use at least 8 characters, with a letter and a number.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password changed.");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-safe py-10">
      <div className="w-full max-w-sm animate-rise">
        <img src="/icons/icon.svg" alt="" className="mx-auto size-14 rounded-2xl" />
        <h1 className="mt-5 text-center text-2xl font-semibold">Choose a new password</h1>
        <div className="mt-6">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Checking your link…</p>
          ) : user ? (
            <form onSubmit={save} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For <b className="text-foreground">{user.email}</b>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="np">New password</Label>
                <PasswordInput
                  id="np"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <PasswordHints value={password} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np2">Confirm new password</Label>
                <PasswordInput
                  id="np2"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                This link has expired or was opened on another device. Get a code instead:
              </p>
              <ResetWithCode
                onDone={() => navigate({ to: "/" })}
                onCancel={() => navigate({ to: "/auth" })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
