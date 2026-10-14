import { useEffect, useState } from "react";
import { Delete, Fingerprint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_ATTEMPTS,
  checkPin,
  removeLock,
  unlock,
  unlockWithBiometrics,
  type LockConfig,
} from "@/lib/applock";
import { cn } from "@/lib/utils";

const ATTEMPTS_KEY = "kudi-lock-attempts";

/** Full-screen PIN / biometric lock shown over the app. */
export function LockScreen({ config, onSignOut }: { config: LockConfig; onSignOut: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const attempts = () => Number(sessionStorage.getItem(ATTEMPTS_KEY) ?? 0);

  async function tryBiometrics() {
    try {
      if (await unlockWithBiometrics()) {
        sessionStorage.removeItem(ATTEMPTS_KEY);
        unlock();
      }
    } catch {
      /* cancelled: fall back to the PIN */
    }
  }

  useEffect(() => {
    if (config.credentialId) void tryBiometrics();
    // only on first show
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(value: string) {
    setBusy(true);
    const ok = await checkPin(value);
    setBusy(false);
    if (ok) {
      sessionStorage.removeItem(ATTEMPTS_KEY);
      unlock();
      return;
    }
    const n = attempts() + 1;
    sessionStorage.setItem(ATTEMPTS_KEY, String(n));
    setError(true);
    setPin("");
    if (n >= MAX_ATTEMPTS) {
      toast.error("Too many wrong PINs. You've been signed out for safety.");
      sessionStorage.removeItem(ATTEMPTS_KEY);
      removeLock();
      onSignOut();
    }
  }

  function press(d: string) {
    if (busy) return;
    setError(false);
    const next = (pin + d).slice(0, config.pinLength);
    setPin(next);
    if (next.length === config.pinLength) void submit(next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"];
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-background px-6 py-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <img src="/icons/icon.svg" alt="" className="size-12 shrink-0 rounded-2xl" />
      <p className="mt-4 text-lg font-semibold">Enter your PIN</p>
      <p className={cn("mt-1 h-5 text-sm", error ? "text-destructive" : "text-muted-foreground")}>
        {error ? `Wrong PIN. ${MAX_ATTEMPTS - attempts()} tries left.` : "KudiLens is locked"}
      </p>
      <div className={cn("mt-6 flex gap-3", error && "animate-[shake_0.3s]")}>
        {Array.from({ length: config.pinLength }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 border-muted-foreground/50 transition-colors",
              i < pin.length && "border-primary bg-primary",
            )}
          />
        ))}
      </div>
      <div className="mt-8 grid w-full max-w-[264px] grid-cols-3 gap-3.5">
        {keys.map((k) =>
          k === "bio" ? (
            config.credentialId ? (
              <button
                key={k}
                onClick={tryBiometrics}
                aria-label="Unlock with Face ID or fingerprint"
                className="grid aspect-square place-items-center rounded-full text-primary hover:bg-accent"
              >
                <Fingerprint className="size-7" />
              </button>
            ) : (
              <span key={k} />
            )
          ) : k === "del" ? (
            <button
              key={k}
              onClick={() => setPin((p) => p.slice(0, -1))}
              aria-label="Delete"
              className="grid aspect-square place-items-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <Delete className="size-6" />
            </button>
          ) : (
            <button
              key={k}
              onClick={() => press(k)}
              className="numeric grid aspect-square place-items-center rounded-full bg-secondary/70 text-2xl font-medium transition-colors hover:bg-accent active:bg-primary/20"
            >
              {k}
            </button>
          ),
        )}
      </div>
      <button
        onClick={() => {
          removeLock();
          onSignOut();
        }}
        className="mt-6 shrink-0 text-sm text-muted-foreground hover:text-foreground"
      >
        Forgot PIN? Sign out
      </button>
    </div>
  );
}

/**
 * When the account has two-step login, ask for the authenticator code before showing the app.
 * Returns null when no code is needed.
 */
export function useNeedsSecondStep(userId: string | undefined) {
  const [needs, setNeeds] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (alive) setNeeds(data?.nextLevel === "aal2" && data.currentLevel !== "aal2");
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  return [needs, () => setNeeds(false)] as const;
}

export function SecondStepScreen({
  onDone,
  onSignOut,
}: {
  onDone: () => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = factors.totp.find((f) => f.status === "verified");
      if (!factor) throw new Error("No authenticator found on this account.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.trim(),
      });
      if (error) throw error;
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code didn't work.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">Two-step login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={verify} className="mt-6 space-y-3">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="numeric text-center text-2xl tracking-[0.5em]"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
        <button
          onClick={onSignOut}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
