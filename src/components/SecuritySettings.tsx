import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  biometricsAvailable,
  enrollBiometrics,
  readLock,
  removeLock,
  setPin,
  updateLock,
  type LockConfig,
} from "@/lib/applock";
import { cn } from "@/lib/utils";

const TIMEOUTS = [
  { value: 0, label: "Right away" },
  { value: 1, label: "After 1 min" },
  { value: 5, label: "After 5 min" },
  { value: 15, label: "After 15 min" },
];

/** PIN + biometric app lock (this device only). */
export function AppLockSettings({ email }: { email: string }) {
  const [cfg, setCfg] = useState<LockConfig | null>(null);
  const [bioOk, setBioOk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");

  const refresh = () => setCfg(readLock());
  useEffect(() => {
    refresh();
    void biometricsAvailable().then(setBioOk);
  }, []);

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("Use 4 to 6 digits.");
      return;
    }
    if (pin !== confirm) {
      toast.error("The PINs don't match.");
      return;
    }
    await setPin(pin);
    setPinValue("");
    setConfirm("");
    setEditing(false);
    refresh();
    toast.success("App lock is on. You'll need your PIN to open KudiLens on this device.");
  }

  async function toggleBio(on: boolean) {
    try {
      if (on) await enrollBiometrics(email || "KudiLens");
      else updateLock({ credentialId: undefined });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't set up Face ID / fingerprint.");
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">App lock</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask for a PIN{bioOk ? ", Face ID or fingerprint" : ""} when KudiLens opens on this device.
      </p>

      {cfg && !editing ? (
        <div className="mt-4 space-y-4">
          {bioOk && (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Unlock with Face ID / fingerprint</span>
              <Switch checked={!!cfg.credentialId} onCheckedChange={toggleBio} />
            </label>
          )}
          <div>
            <p className="text-sm">Lock again when I leave the app</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIMEOUTS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    updateLock({ timeoutMinutes: t.value });
                    refresh();
                  }}
                  className={cn(
                    "rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent",
                    cfg.timeoutMinutes === t.value && "border-primary bg-primary/10 text-primary",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Change PIN
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                removeLock();
                refresh();
                toast.success("App lock turned off.");
              }}
            >
              Turn off
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={savePin} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pin">New PIN (4–6 digits)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin2">Confirm PIN</Label>
            <Input
              id="pin2"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{cfg ? "Save new PIN" : "Turn on app lock"}</Button>
            {editing && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

/** Authenticator-app (TOTP) two-step login via Supabase MFA. */
export function TwoStepSettings() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp.find((f) => f.status === "verified")?.id ?? null);
  }
  useEffect(() => {
    void load();
  }, []);

  async function start() {
    setBusy(true);
    // clear any half-finished setup first
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? [])
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrolling(null);
    setCode("");
    await load();
    toast.success("Two-step login is on.");
  }

  async function turnOff() {
    if (!factorId) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
    toast.success("Two-step login turned off.");
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Two-step login</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        After your password or Google, also ask for a 6-digit code from an authenticator app (Google
        Authenticator, Microsoft Authenticator, 1Password…).
      </p>
      {factorId ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-success/12 px-2 py-1 text-sm text-success">On</span>
          <Button variant="ghost" className="text-destructive" onClick={turnOff}>
            Turn off
          </Button>
        </div>
      ) : enrolling ? (
        <form onSubmit={confirm} className="mt-4 space-y-3">
          <p className="text-sm">
            Scan this with your authenticator app, then enter the code it shows.
          </p>
          <img
            src={enrolling.qr}
            alt="QR code for your authenticator app"
            className="size-44 rounded-xl bg-white p-2"
          />
          <p className="text-xs text-muted-foreground">
            Can't scan? Enter this key:{" "}
            <span className="numeric break-all">{enrolling.secret}</span>
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="numeric max-w-40 tracking-[0.3em]"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || code.length !== 6}>
              Confirm
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEnrolling(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button className="mt-4" onClick={start} disabled={busy}>
          Set up two-step login
        </Button>
      )}
    </section>
  );
}
