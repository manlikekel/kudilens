import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { FinanceData } from "@/lib/finance";
import { Progress } from "@/components/ui/progress";

/** Shows which parts of the user's numbers are still missing, with a link to fill each one. */
export function SetupChecklist({ data, hasTxns }: { data: FinanceData; hasTxns: boolean }) {
  const steps = [
    { label: "Add your age", done: !!data.profile?.age },
    { label: "Add income", done: data.flows.some((f) => f.flow_type === "income") },
    { label: "Add monthly spending", done: data.flows.some((f) => f.flow_type === "expense") },
    { label: "Add bank accounts", done: (data.accounts ?? []).length > 0 },
    { label: "Add your household", done: data.family.length > 0 },
    { label: "Set a goal", done: (data.goals ?? []).length > 0 },
    { label: "Add debts or investments", done: data.debts.length + data.investments.length > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length + (hasTxns ? 1 : 0);
  const total = steps.length + 1;
  if (doneCount === total) return null;

  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Finish setting up</p>
        <p className="text-xs text-muted-foreground">
          {doneCount} of {total} done
        </p>
      </div>
      <Progress value={(doneCount / total) * 100} className="mt-2 h-2" />
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label}>
            {s.done ? (
              <span className="flex items-center gap-2 text-muted-foreground line-through">
                <Check className="size-4 text-success" /> {s.label}
              </span>
            ) : (
              <Link to="/records" className="text-primary underline">
                {s.label}
              </Link>
            )}
          </li>
        ))}
        <li>
          {hasTxns ? (
            <span className="flex items-center gap-2 text-muted-foreground line-through">
              <Check className="size-4 text-success" /> Import a bank statement
            </span>
          ) : (
            <Link to="/spending" className="text-primary underline">
              Import a bank statement
            </Link>
          )}
        </li>
      </ul>
    </section>
  );
}
