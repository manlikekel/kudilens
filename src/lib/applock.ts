import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * App lock: a PIN (and optionally the device's Face ID / fingerprint via WebAuthn) required when
 * the app opens or comes back after a while. It is a device-level privacy screen on top of the
 * account login, so everything is stored on this device only. The PIN is never stored: we keep a
 * PBKDF2 hash with a random salt.
 */

const KEY = "kudi-lock";
export const MAX_ATTEMPTS = 5;

export interface LockConfig {
  salt: string; // base64
  hash: string; // base64 PBKDF2-SHA256
  pinLength: number;
  /** WebAuthn credential id (base64) when biometrics are enabled */
  credentialId?: string | undefined;
  /** lock again after the app has been in the background this long */
  timeoutMinutes: number;
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPin(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    key,
    256,
  );
  return b64(bits);
}

export function readLock(): LockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

function writeLock(cfg: LockConfig | null) {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export async function setPin(pin: string, timeoutMinutes = 1) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prev = readLock();
  writeLock({
    salt: b64(salt),
    hash: await hashPin(pin, salt),
    pinLength: pin.length,
    timeoutMinutes: prev?.timeoutMinutes ?? timeoutMinutes,
    credentialId: prev?.credentialId,
  });
}

export async function checkPin(pin: string) {
  const cfg = readLock();
  if (!cfg) return true;
  return (await hashPin(pin, unb64(cfg.salt))) === cfg.hash;
}

export function updateLock(patch: Partial<LockConfig>) {
  const cfg = readLock();
  if (cfg) writeLock({ ...cfg, ...patch });
}

export function removeLock() {
  writeLock(null);
  state.locked = false;
  emit();
}

/* ---------------- biometrics (WebAuthn, checked on this device only) ---------------- */

export async function biometricsAvailable() {
  try {
    return (
      typeof PublicKeyCredential !== "undefined" &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export async function enrollBiometrics(label: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "KudiLens", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label, displayName: label },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Biometric setup was cancelled.");
  updateLock({ credentialId: b64(cred.rawId) });
}

export async function unlockWithBiometrics() {
  const cfg = readLock();
  if (!cfg?.credentialId) return false;
  const res = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: unb64(cfg.credentialId) as BufferSource }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return !!res;
}

/* ---------------- locked state ---------------- */

const listeners = new Set<() => void>();
const state = { locked: false, hiddenAt: 0, started: false };
function emit() {
  listeners.forEach((l) => l());
}
let version = 0;
listeners.add(() => version++);

export function unlock() {
  state.locked = false;
  emit();
}

export function lockNow() {
  if (readLock()) {
    state.locked = true;
    emit();
  }
}

/**
 * Locks on first load when a PIN is set, and again when the app returns from the background
 * after the chosen timeout.
 */
export function useAppLock() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // lock once per app launch (every page mounts the shell again, so guard with `started`)
    if (!state.started) {
      state.started = true;
      if (readLock()) state.locked = true;
    }
    setReady(true);
    emit();
    const onVisibility = () => {
      const cfg = readLock();
      if (!cfg) return;
      if (document.visibilityState === "hidden") state.hiddenAt = Date.now();
      else if (state.hiddenAt && Date.now() - state.hiddenAt >= cfg.timeoutMinutes * 60_000)
        lockNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
  return { locked: ready && state.locked, config: ready ? readLock() : null };
}
