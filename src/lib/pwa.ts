import { useEffect, useState } from "react";

/* ---------------- theme ---------------- */

export type ThemeChoice = "system" | "light" | "dark";
const THEME_KEY = "kudi-theme";
const THEME_COLOR = { light: "#f6f7fa", dark: "#0c111d" };

/**
 * Runs inline in <head> before first paint so the saved theme never flashes, and keeps the
 * install-prompt event if the browser fires it before React mounts.
 */
export const bootScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__kudiInstall=e;});})();`;

export function getTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode: still apply for this visit */
  }
  const root = document.documentElement;
  if (choice === "system") delete root.dataset["theme"];
  else root.dataset["theme"] = choice;
  const resolved =
    choice === "system"
      ? matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : choice;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (choice === "system")
      m.setAttribute(
        "content",
        m.getAttribute("media")?.includes("light") ? THEME_COLOR.light : THEME_COLOR.dark,
      );
    else m.setAttribute("content", THEME_COLOR[resolved]);
  });
}

export const themeColor = THEME_COLOR;

/* ---------------- service worker ---------------- */

/** Registers the offline service worker on the live site only (not in dev or inside an editor iframe). */
export function registerServiceWorker(onUpdated?: () => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV || window.self !== window.top) return;

  const register = async () => {
    try {
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      // a new version took over while the app was open: let the user refresh into it
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController) onUpdated?.();
      });
      // look for a new version when the app comes back to the foreground
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update();
      });
      await registerBackgroundRefresh(reg);
    } catch (err) {
      console.warn("Service worker not registered", err);
    }
  };
  // React effects run after the load event has usually fired, so don't wait for it again
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}

type SyncRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> };
  periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
};

/** Market data refreshes when the connection returns, and daily for the installed app where supported. */
async function registerBackgroundRefresh(reg: SyncRegistration) {
  try {
    await reg.sync?.register("refresh-market");
  } catch {
    /* background sync not supported */
  }
  try {
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (status.state === "granted")
      await reg.periodicSync?.register("refresh-market", { minInterval: 24 * 3600_000 });
  } catch {
    /* periodic sync only exists for installed apps on Chromium */
  }
}

/** Online / offline status for showing a banner. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ---------------- install prompt ---------------- */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __kudiInstall?: InstallEvent | undefined;
  }
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * `mode` is "prompt" when the browser can install with one tap (Chrome, Edge, Samsung, Android),
 * "ios" when the user has to use Share → Add to Home Screen, and null when already installed
 * or not installable.
 */
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | undefined>();
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (window.__kudiInstall) {
      setEvent(window.__kudiInstall);
      setMode("prompt");
    } else if (isIOS()) {
      setMode("ios");
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__kudiInstall = e as InstallEvent;
      setEvent(e as InstallEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      window.__kudiInstall = undefined;
      setMode(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    window.__kudiInstall = undefined;
    setEvent(undefined);
    if (outcome === "accepted") setMode(null);
    return outcome === "accepted";
  }

  return { mode, install };
}
