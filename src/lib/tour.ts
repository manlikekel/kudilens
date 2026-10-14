import { useSyncExternalStore } from "react";

/**
 * Guided tour state. Steps point at elements marked with data-tour="…". When an element exists
 * twice (sidebar on desktop, tab bar on phones) the visible one is used.
 */

export interface TourStep {
  /** data-tour value; omit for a centred card */
  target?: string;
  /** alternatives tried in order when the first target isn't visible (e.g. "More" on phones) */
  fallback?: string[];
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to KudiLens",
    body: "A 1-minute tour of where everything is. You can skip it and come back any time from Help & guide.",
  },
  {
    target: "hero",
    title: "Your net worth",
    body: "Everything you own minus everything you owe, and where it's expected to be in 10 years. Update your numbers here.",
  },
  {
    target: "insights",
    title: "What the data says",
    body: "A plain-English summary of your finances and your next steps. Tap 'See the detailed breakdown' for the full reasoning.",
  },
  {
    target: "safe-to-spend",
    title: "Safe to spend",
    body: "What's left this month after debts, investing, bills and money set aside for yearly costs, and what that means per day.",
  },
  {
    target: "nav-plan",
    title: "Plan",
    body: "Forecasts with good and bad cases, your goals' chances, debt payoff plans and what-if scenarios like buying a car.",
  },
  {
    target: "nav-invest",
    title: "Invest",
    body: "Regulated platforms in your country, fund and ETF returns, and a check of how your own money is set up.",
  },
  {
    target: "nav-advisor",
    title: "Ask Kudi",
    body: "Ask questions about your money in your own words. Answers use your actual numbers.",
  },
  {
    target: "nav-records",
    fallback: ["nav-more"],
    title: "My numbers",
    body: "Income, spending, accounts, debts, investments, goals and family. Everything in the app is worked out from these, so keep them current. On phones it's under More.",
  },
  {
    target: "privacy",
    title: "Hide amounts",
    body: "In public? Tap the eye to hide every amount. App lock, two-step login and your country are in Settings.",
  },
  {
    title: "You're all set",
    body: "Start by checking My numbers are right. The 'How KudiLens works' guide in the menu explains every section whenever you need it.",
  },
];

const DONE_KEY = "kudi-tour-done";
const listeners = new Set<() => void>();
let state: { step: number | null } = { step: null };
const emit = () => listeners.forEach((l) => l());

export function startTour() {
  state = { step: 0 };
  emit();
}

export function setTourStep(step: number | null) {
  state = { step };
  if (step == null) {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function tourSeen() {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function useTourStep() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state.step,
    () => null,
  );
}

/** The visible element for a step, trying fallbacks; null when nothing is on screen. */
export function findTarget(step: TourStep): HTMLElement | null {
  for (const key of [step.target, ...(step.fallback ?? [])]) {
    if (!key) continue;
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}
