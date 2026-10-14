import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { isAuthApiError } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — KudiLens" },
      { name: "description", content: "Manage your sign-in email and password." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  email: "Email & password",
  apple: "Apple",
};

function Settings() {
  const { user } = useAuth();
  if (!user) return null;
  const providers = [...new Set((user.identities ?? []).map((i) => i.provider))];
  const pendingEmail = user.new_email;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your sign-in details.</p>
      </div>

      <section className="panel space-y-3 p-5">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Email</span>
          <span className="numeric break-all">{user.email ?? "None yet"}</span>
        </div>
        {pendingEmail && (
          <p className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
            Waiting for you to confirm {pendingEmail}. Click the link we emailed to finish the
            change.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Sign-in methods</span>
          <span className="flex flex-wrap gap-1.5">
            {providers.length === 0 && <Badge variant="secondary">Unknown</Badge>}
            {providers.map((p) => (
              <Badge key={p} variant="secondary">
                {PROVIDER_LABEL[p] ?? p}
              </Badge>
            ))}
          </span>
        </div>
      </section>

      <EmailForm current={user.email ?? ""} />
      <PasswordForm email={user.email ?? ""} hasPassword={providers.includes("email")} />
    </div>
  );
}

function EmailForm({ current }: { current: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (next === current.toLowerCase()) {
      toast.error("That's already your email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/settings` },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail("");
    toast.success(`Check ${next} for a confirmation link. Your email changes once you click it.`);
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">{current ? "Change email" : "Add an email"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll send a confirmation link to the new address. Until you click it, you keep signing in
        with the current one.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-email">New email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || !email}>
          {busy ? "Sending…" : "Send confirmation link"}
        </Button>
      </form>
    </section>
  );
}

function PasswordForm({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nonce, setNonce] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser(
        needsCode ? { password, nonce: nonce.trim() } : { password },
      );
      if (error) {
        // Projects with "secure password change" on want a one-time code emailed to the user first.
        if (
          isAuthApiError(error) &&
          (error.code === "reauthentication_needed" || error.code === "reauth_nonce_missing")
        ) {
          const re = await supabase.auth.reauthenticate();
          if (re.error) throw re.error;
          setNeedsCode(true);
          toast.message(`We emailed a code to ${email}. Enter it below to save your password.`);
          return;
        }
        throw error;
      }
      setPassword("");
      setConfirm("");
      setNonce("");
      setNeedsCode(false);
      toast.success(
        hasPassword
          ? "Password changed."
          : `Password added. You can now also sign in with ${email} and this password.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">
        {hasPassword ? "Change password" : "Add a password"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasPassword
          ? "Pick a new password for signing in with your email."
          : "You sign in with Google. Add a password to also sign in with your email, for example on devices where Google sign-in isn't available."}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {needsCode && (
          <div className="space-y-1.5">
            <Label htmlFor="reauth-code">Code from your email</Label>
            <Input
              id="reauth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" disabled={busy || !email}>
          {busy ? "Saving…" : hasPassword ? "Change password" : "Add password"}
        </Button>
        {!email && <p className="text-xs text-muted-foreground">Add an email above first.</p>}
      </form>
    </section>
  );
}
