import type { Insight } from "./insights";

export interface InsightSummary {
  /** one or two plain sentences: the overall picture */
  headline: string;
  counts: { critical: number; watch: number; good: number };
  /** the most important actions, in order */
  nextSteps: string[];
  /** one thing going well, to end on */
  goingWell: string | null;
  tone: "critical" | "watch" | "good" | "empty";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Turns the list of insights into a short summary someone can read in ten seconds. */
export function summarizeInsights(insights: Insight[]): InsightSummary {
  const critical = insights.filter((i) => i.severity === "critical");
  const watch = insights.filter((i) => i.severity === "watch");
  const good = insights.filter((i) => i.severity === "good");
  const counts = { critical: critical.length, watch: watch.length, good: good.length };

  if (!insights.length)
    return {
      headline: "Add your income, spending, debts and investments to get a read on your finances.",
      counts,
      nextSteps: [],
      goingWell: null,
      tone: "empty",
    };

  let headline: string;
  let tone: InsightSummary["tone"];
  if (critical.length) {
    tone = "critical";
    headline =
      `${plural(critical.length, "thing needs", "things need")} your attention now. ` +
      `The biggest: ${lowerFirst(critical[0]!.title)}.`;
  } else if (watch.length) {
    tone = "watch";
    headline =
      `Nothing urgent. ${plural(watch.length, "thing", "things")} to keep an eye on, ` +
      `starting with ${lowerFirst(watch[0]!.title)}.`;
  } else {
    tone = "good";
    headline = `You're in good shape: ${plural(good.length, "area looks", "areas look")} healthy.`;
  }

  return {
    headline,
    counts,
    nextSteps: [...critical, ...watch].slice(0, 3).map((i) => i.action),
    goingWell: good[0]?.title ?? null,
    tone,
  };
}
