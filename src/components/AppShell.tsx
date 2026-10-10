import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LineChart, MessageCircle, Table2, LogOut, Compass, Bell, Lightbulb, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFinance } from "@/lib/useFinance";
import { getRates, missingCurrencies, rateLabel, usedCurrencies } from "@/lib/finance";

/** Shows which exchange rates every converted figure uses, and warns when one is missing. */
function RateBar({ userId }: { userId: string }) {
  const { data, error } = useFinance(userId);
  if (error) return <div className="bg-destructive/15 px-4 py-2 text-center text-xs text-destructive">Could not load your data: {error.message}</div>;
  if (!data) return null;
  const rates = getRates(data);
  const base = data.profile?.base_currency ?? "NGN";
  const missing = missingCurrencies([...usedCurrencies(data), "NGN"], base, rates);
  return (
    <div className="print:hidden">
      {missing.length > 0 && (
        <div className="bg-warning/15 px-4 py-2 text-center text-xs text-warning">
          No exchange rate for {missing.join(", ")} — those amounts are left out of totals. Add a rate in My numbers → Profile.
        </div>
      )}
      <p className="mx-auto max-w-6xl px-4 pt-2 text-right text-[11px] text-muted-foreground">{rateLabel(rates)}</p>
    </div>
  );
}

const nav = [
  { to: "/", label: "Dashboard", icon: LineChart },
  { to: "/plan", label: "Plan", icon: Compass },
  { to: "/insights", label: "Insights", icon: Bell },
  { to: "/ideas", label: "My Ideas", icon: Lightbulb },
  { to: "/advisor", label: "Ask Kudi", icon: MessageCircle },
  { to: "/review", label: "Review", icon: FileText },
  { to: "/records", label: "My numbers", icon: Table2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your finances…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="print:hidden sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-display text-lg font-semibold tracking-tight">
            Kudi<span className="text-primary">Lens</span>
          </span>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  pathname === item.to && "bg-secondary text-foreground",
                )}
              >
                <item.icon className="size-4" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <RateBar userId={user.id} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
