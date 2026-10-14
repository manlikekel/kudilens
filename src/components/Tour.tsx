import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS, findTarget, setTourStep, useTourStep } from "@/lib/tour";
import { cn } from "@/lib/utils";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

/** Spotlight tour over the dashboard and navigation. Rendered once by the app shell. */
export function Tour() {
  const step = useTourStep();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [box, setBox] = useState<Box | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  // the tour lives on the dashboard
  useEffect(() => {
    if (step != null && pathname !== "/") navigate({ to: "/" });
  }, [step, pathname, navigate]);

  const measure = useCallback(() => {
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    if (step == null) return;
    const s = TOUR_STEPS[step];
    const el = s ? findTarget(s) : null;
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    });
  }, [step]);

  // bring the target into view, then measure once scrolling settles
  useLayoutEffect(() => {
    if (step == null) return;
    const s = TOUR_STEPS[step];
    const el = s ? findTarget(s) : null;
    const fixed =
      el && getComputedStyle(el.closest("nav, aside, header") ?? el).position === "fixed";
    if (el && !fixed) el.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const t = setTimeout(measure, 450);
    return () => clearTimeout(t);
  }, [step, pathname, measure]);

  useEffect(() => {
    if (step == null) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTourStep(null);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft" && step > 0) setTourStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
  });

  if (step == null) return null;
  const s = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;
  function next() {
    setTourStep(last ? null : step! + 1);
  }

  // place the card below the target when there's room, else above; centred without a target
  const cardW = Math.min(360, vw - 24);
  const below = box ? box.top + box.height + 220 < vh : false;
  const cardStyle: React.CSSProperties = box
    ? {
        width: cardW,
        left: Math.min(Math.max(12, box.left + box.width / 2 - cardW / 2), vw - cardW - 12),
        ...(below
          ? { top: box.top + box.height + 12 }
          : { bottom: Math.max(12, vh - box.top + 12) }),
      }
    : { width: cardW, left: (vw - cardW) / 2, top: "50%", transform: "translateY(-50%)" };

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* dim everything except the spotlight */}
      {box ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-primary transition-all duration-300"
          style={{ ...box, boxShadow: "0 0 0 9999px oklch(0.1 0.02 262 / 0.66)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-[oklch(0.1_0.02_262/0.66)]" />
      )}
      <div className="fixed inset-0" onClick={next} aria-hidden="true" />

      <div className="panel fixed p-5 shadow-2xl animate-rise" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-primary">
            {step + 1} of {TOUR_STEPS.length}
          </p>
          <button
            onClick={() => setTourStep(null)}
            aria-label="Close the tour"
            className="-m-1 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 text-lg font-semibold">
          {s.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full bg-secondary transition-all",
                  i === step ? "w-4 bg-primary" : "w-1.5",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setTourStep(step - 1)}>
                Back
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setTourStep(null)}>
                Skip
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
