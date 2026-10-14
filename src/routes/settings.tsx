import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Monitor, Moon, Share, Sun } from "lucide-react";
import { toast } from "sonner";
import { isAuthApiError } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordHints, PasswordInput, passwordOk } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getTheme, isStandalone, setTheme, useInstall, type ThemeChoice } from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { CountrySelect } from "@/components/CountrySelect";
import { AppLockSettings, TwoStepSettings } from "@/components/SecuritySettings";
import { DataSettings } from "@/components/DataSettings";
import { ResetWithCode } from "@/components/AuthCodes";

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

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">Country</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sets which regulators, investment platforms and funds the Invest page shows.
        </p>
        <CountrySelect className="mt-4 sm:w-72" />
      </section>
      <AppLockSettings email={user.email ?? ""} />
      <TwoStepSettings />
      <Appearance />
      <InstallApp />
      <EmailForm current={user.email ?? ""} />
      <PasswordForm email={user.email ?? ""} hasPassword={providers.includes("email")} />
      <DataSettings email={user.email ?? ""} />
      <p className="pb-2 text-center text-xs text-muted-foreground">
        <a href="/privacy" className="hover:text-foreground">
          Privacy policy
        </a>{" "}
        ·{" "}
        <a href="/terms" className="hover:text-foreground">
          Terms of use
        </a>
      </p>
    </div>
  );
}

function Appearance() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(getTheme()), []);
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: "system", label: "Device", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Device follows your phone or computer setting.
      </p>
      <div role="radiogroup" aria-label="Theme" className="mt-4 grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={choice === o.value}
            onClick={() => {
              setTheme(o.value);
              setChoice(o.value);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-accent",
              choice === o.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            <o.icon className="size-5" />
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function InstallApp() {
  const { mode, install } = useInstall();
  const [installed, setInstalled] = useState(false);
  useEffect(() => setInstalled(isStandalone()), []);
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Install the app</h2>
      {installed ? (
        <p className="mt-1 text-sm text-muted-foreground">You're using the installed app.</p>
      ) : mode === "prompt" ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Add KudiLens to your home screen or desktop. It opens full screen, like any other app.
          </p>
          <Button className="mt-4" onClick={install}>
            <Download /> Install KudiLens
          </Button>
        </>
      ) : mode === "ios" ? (
        <p className="mt-1 text-sm text-muted-foreground">
          In Safari, tap <Share className="inline size-4 align-text-bottom" /> Share, then “Add to
          Home Screen”.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Open KudiLens in Chrome, Edge or Samsung Internet (Android, Windows, Mac) or Safari
          (iPhone, iPad) to install it. If you don't see the option, it may already be installed.
        </p>
      )}
    </section>
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
  const [resetting, setResetting] = useState(false);

  async function submit(e: React.FormEvent) {
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
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordHints value={password} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <PasswordInput
            id="confirm-password"
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
      {hasPassword && email && (
        <div className="mt-5 border-t border-border pt-4">
          {resetting ? (
            <ResetWithCode
              initialEmail={email}
              lockEmail
              onDone={() => setResetting(false)}
              onCancel={() => setResetting(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setResetting(true)}
              className="text-sm text-primary hover:underline"
            >
              Forgot your current password? Reset it with an emailed code
            </button>
          )}
        </div>
      )}
    </section>
  );
}
