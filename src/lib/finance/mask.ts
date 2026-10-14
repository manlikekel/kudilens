/**
 * Privacy-mode switch read by formatMoney. Plain module state (no React) so the finance library
 * stays usable on the server, where it is always off. The UI hook lives in src/lib/privacy.ts.
 */
const KEY = "kudi-privacy";
const listeners = new Set<() => void>();
let hidden = (() => {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

export function amountsHidden() {
  return hidden;
}

export function setAmountsHidden(next: boolean) {
  hidden = next;
  try {
    if (next) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* still applies for this visit */
  }
  listeners.forEach((l) => l());
}

export function onAmountsHiddenChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
