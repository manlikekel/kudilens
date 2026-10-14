import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeInsights, type Insight } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** A short readable summary first; the full insight cards open on demand. */
export function InsightsSection({ insights }: { insights: Insight[] }) {
  const [open, setOpen] = useState(false);
  const sum = useMemo(() => summarizeInsights(insights), [insights]);

  return (
    <section className="panel p-5" data-tour="insights">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-4 text-primary" /> What the data says
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link to="/advisor">Ask Kudi →</Link>
        </Button>
      </div>

      <p
        className={cn(
          "mt-3 text-[15px] leading-relaxed",
          sum.tone === "critical" && "text-foreground",
          sum.tone === "empty" && "text-muted-foreground",
        )}
      >
        {sum.headline}
      </p>

      {sum.tone !== "empty" && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {sum.counts.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2.5 py-1 text-destructive">
              <AlertTriangle className="size-3.5" /> {sum.counts.critical} to fix now
            </span>
          )}
          {sum.counts.watch > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2.5 py-1 text-warning">
              <Eye className="size-3.5" /> {sum.counts.watch} to watch
            </span>
          )}
          {sum.counts.good > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-success">
              <CheckCircle2 className="size-3.5" /> {sum.counts.good} going well
            </span>
          )}
        </div>
      )}

      {sum.nextSteps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Your next steps
          </p>
          <ol className="mt-2 space-y-2">
            {sum.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {sum.goingWell && (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            Going well: <span className="text-foreground">{sum.goingWell}</span>
          </span>
        </p>
      )}

      {insights.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent"
        >
          {open ? "Hide the detailed breakdown" : `See the detailed breakdown (${insights.length})`}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      )}

      {open && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {insights.map((ins) => (
            <article
              key={ins.id}
              className={cn(
                "rounded-xl border border-border border-l-4 bg-background/40 p-4",
                ins.severity === "critical" && "border-l-destructive",
                ins.severity === "watch" && "border-l-warning",
                ins.severity === "good" && "border-l-success",
              )}
            >
              <div className="flex items-start gap-2">
                {ins.severity === "critical" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : ins.severity === "watch" ? (
                  <Eye className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                )}
                <div className="min-w-0">
                  <h3 className="font-medium">{ins.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{ins.detail}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-primary">Do this: </span>
                    {ins.action}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
