import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { healthReport, type FinanceData } from "@/lib/finance";
import { cn } from "@/lib/utils";

const tone = (score: number) =>
  score >= 80
    ? "text-success"
    : score >= 60
      ? "text-primary"
      : score >= 40
        ? "text-warning"
        : "text-destructive";

const bar = (score: number) =>
  score >= 80
    ? "bg-success"
    : score >= 60
      ? "bg-primary"
      : score >= 40
        ? "bg-warning"
        : "bg-destructive";

/** Financial health out of 100, with the best next step and the five parts behind it. */
export function HealthCard({ data }: { data: FinanceData }) {
  const [open, setOpen] = useState(false);
  const r = useMemo(() => healthReport(data), [data]);
  const ring = 2 * Math.PI * 34;

  return (
    <section className="panel p-5" data-tour="health">
      <div className="flex items-center gap-5">
        <div className="relative size-24 shrink-0">
          <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden="true">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="8"
              className="stroke-secondary"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={cn("transition-all duration-700", tone(r.score))}
              stroke="currentColor"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - r.score / 100)}
            />
          </svg>
          <p
            className={cn(
              "numeric absolute inset-0 grid place-items-center text-2xl font-semibold",
              tone(r.score),
            )}
          >
            {r.score}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Financial health
          </p>
          <p className={cn("text-lg font-semibold", tone(r.score))}>{r.grade}</p>
          {r.focus && (
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">To raise it: </span>
              {r.focus.tip}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-4 flex items-center gap-1 text-sm text-primary"
      >
        {open ? "Hide the breakdown" : "See what makes up your score"}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-3 space-y-4">
          {r.parts.map((p) => (
            <li key={p.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="numeric text-muted-foreground">{Math.round(p.points)} / 20</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", bar(p.points * 5))}
                  style={{ width: `${(p.points / 20) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.status}</p>
              {p.tip && <p className="mt-0.5 text-xs">{p.tip}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
