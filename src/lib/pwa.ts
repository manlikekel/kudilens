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
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV || window.self !== window.top) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("Service worker not registered", err));
  });
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
