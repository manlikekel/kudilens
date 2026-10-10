import type { ReactNode } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { formatMoney } from "@/lib/finance/fx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function Disclaimer() {
  return (
    <p className="text-xs text-muted-foreground">
      Insights are educational and based on your own data and assumptions, not licensed financial advice.
    </p>
  );
}

export function compact(n: number, cur = "NGN") {
  return formatMoney(n, cur);
}

/** A number you can tap to see how it was calculated. */
export function Num({ children, formula }: { children: ReactNode; formula: string }) {
  return (
    <Popover>
      <PopoverTrigger className="numeric inline-flex items-center gap-1 underline decoration-dotted decoration-muted-foreground underline-offset-4">
        {children}
        <Info className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-xs leading-relaxed">
        <p className="mb-1 font-medium">How this is calculated</p>
        {formula}
      </PopoverContent>
    </Popover>
  );
}

export function Meaning({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-md bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What this means: </span>
      {children}
    </p>
  );
}

export interface ChartSpec {
  type?: "bar" | "line";
  title?: string;
  data: { label: string; value: number }[];
}

export function InlineChart({ spec }: { spec: ChartSpec }) {
  const data = (spec.data ?? []).filter((d) => Number.isFinite(Number(d.value)));
  if (!data.length) return null;
  const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };
  return (
    <div className="not-prose my-3 rounded-lg border border-border p-3">
      {spec.title && <p className="mb-2 text-xs font-medium">{spec.title}</p>}
      <div className="h-40">
        <ResponsiveContainer>
          {spec.type === "line" ? (
            <LineChart data={data}>
              <XAxis dataKey="label" {...axis} />
              <YAxis tickFormatter={(v) => compact(v)} width={56} {...axis} />
              <Tooltip formatter={(v: number) => compact(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
              <Line dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <XAxis dataKey="label" {...axis} />
              <YAxis tickFormatter={(v) => compact(v)} width={56} {...axis} />
              <Tooltip formatter={(v: number) => compact(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
              <Bar dataKey="value" fill="var(--primary)" radius={4} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
