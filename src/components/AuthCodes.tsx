import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordHints, PasswordInput, passwordOk } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";

/** Seconds left before the user may ask for another email (Supabase rate-limits resends). */
export function useCooldown(seconds = 60, startNow = false) {
  const [left, setLeft] = useState(startNow ? seconds : 0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(seconds)] as const;
}

/** A single 6-digit code field that also accepts a pasted code and the phone's autofill. */
export function CodeInput({
  value,
  onChange,
  id = "code",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="numeric h-14 text-center text-2xl tracking-[0.6em]"
      placeholder="••••••"
      autoFocus
    />
  );
}

/** Enter the code emailed after sign-up to confirm the address and sign in. */
export function VerifySignup({ email, onBack }: { email: string; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // the sign-up email has just gone out, so start the resend timer straight away
  const [left, restart] = useCooldown(60, true);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    setBusy(false);
    if (error) {
      toast.error(
        /expired|invalid/i.test(error.message)
          ? "That code is wrong or has expired. Request a new one."
          : error.message,
      );
      setCode("");
      return;
    }
    toast.success("Email confirmed. Welcome to KudiLens!");
    // the auth listener picks up the new session and the page moves on
  }

  async function resend() {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("New code sent.");
      restart();
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to <b className="text-foreground">{email}</b>. Enter it to confirm
        your email. You can also tap the link in the email.
      </p>
      <CodeInput value={code} onChange={setCode} />
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Confirm email"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={left > 0}
          className="text-primary disabled:text-muted-foreground"
        >
          {left > 0 ? `Resend in ${left}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}

/**
 * Password reset by emailed code: send the code, then enter it with a new password. Works signed
 * out (sign-in page) and signed in (Settings). The email's link works too, via /reset-password.
 */
export function ResetWithCode({
  initialEmail = "",
  lockEmail = false,
  onDone,
  onCancel,
}: {
  initialEmail?: string;
  lockEmail?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCooldown();

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    restart();
    // same message whether or not the address has an account, so emails can't be probed
    toast.success(`If ${email.trim()} has an account, a code is on its way.`);
  }

  async function reset(e: React.FormEvent) {
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
      const { error: codeError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "recovery",
      });
      if (codeError)
        throw new Error(
          /expired|invalid/i.test(codeError.message)
            ? "That code is wrong or has expired."
            : codeError.message,
        );
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password changed. You're signed in.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reset your password.");
    } finally {
      setBusy(false);
    }
  }

  if (!sent)
    return (
      <form onSubmit={send} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={lockEmail}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {busy ? "Sending…" : "Email me a reset code"}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </form>
    );

  return (
    <form onSubmit={reset} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code sent to <b className="text-foreground">{email.trim()}</b> and choose
        a new password.
      </p>
      <CodeInput id="reset-code" value={code} onChange={setCode} />
      <div className="space-y-1.5">
        <Label htmlFor="reset-new">New password</Label>
        <PasswordInput
          id="reset-new"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordHints value={password} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <PasswordInput
          id="reset-confirm"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
        {busy ? "Saving…" : "Set new password"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={left > 0 || busy}
          className="text-primary disabled:text-muted-foreground"
        >
          {left > 0 ? `Resend in ${left}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
