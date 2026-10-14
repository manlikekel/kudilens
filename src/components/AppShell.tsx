import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Compass,
  Download,
  Eye,
  EyeOff,
  FileText,
  Home,
  Lightbulb,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Receipt,
  Settings,
  Share,
  SquarePlus,
  Table2,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useFinance } from "@/lib/useFinance";
import { useInstall } from "@/lib/pwa";
import { usePrivacy } from "@/lib/privacy";
import { getRates, missingCurrencies, rateLabel, usedCurrencies } from "@/lib/finance";

/** Shows which exchange rates every converted figure uses, and warns when one is missing. */
function RateBar({ userId }: { userId: string }) {
  const { data, error } = useFinance(userId);
  if (error)
    return (
      <div className="rounded-xl bg-destructive/12 px-4 py-2.5 text-center text-xs text-destructive">
        Could not load your data: {error.message}
      </div>
    );
  if (!data) return null;
  const rates = getRates(data);
  const base = data.profile?.base_currency ?? "NGN";
  const missing = missingCurrencies([...usedCurrencies(data), "NGN"], base, rates);
  return (
    <div className="space-y-2 print:hidden">
      {missing.length > 0 && (
        <div className="rounded-xl bg-warning/12 px-4 py-2.5 text-center text-xs text-warning">
          No exchange rate for {missing.join(", ")} — those amounts are left out of totals. Add a
          rate in My numbers → Profile.
        </div>
      )}
      <p className="text-right text-[11px] text-muted-foreground">{rateLabel(rates)}</p>
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: Home },
      { to: "/plan", label: "Plan", icon: Compass },
      { to: "/invest", label: "Invest", icon: TrendingUp },
      { to: "/spending", label: "Spending", icon: Receipt },
      { to: "/insights", label: "Insights", icon: Bell },
    ],
  },
  {
    label: "Advice",
    items: [
      { to: "/advisor", label: "Ask Kudi", icon: MessageCircle },
      { to: "/ideas", label: "My Ideas", icon: Lightbulb },
      { to: "/review", label: "Review", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/records", label: "My numbers", icon: Table2 },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
const allItems = groups.flatMap((g) => g.items);
/** Bottom tab bar on phones; everything else lives under "More". */
const tabs = ["/", "/plan", "/invest", "/advisor"];
const tabItems = tabs.map((t) => allItems.find((i) => i.to === t)!);
const moreItems = allItems.filter((i) => !tabs.includes(i.to));

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)}>
      <img src="/icons/icon.svg" alt="" className="size-8 rounded-[10px] shadow-sm" />
      <span className="font-display text-[17px] font-semibold tracking-tight">
        Kudi<span className="text-primary">Lens</span>
      </span>
    </Link>
  );
}

function initials(email: string | undefined) {
  return (email ?? "?").slice(0, 1).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const { mode: installMode, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  const [hidden, setHidden] = usePrivacy();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => setMoreOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-muted-foreground">
        <img src="/icons/icon.svg" alt="" className="size-14 animate-pulse rounded-2xl" />
        <p className="text-sm">Loading your finances…</p>
      </div>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };
  const onInstall = async () => {
    if (installMode === "ios") setIosHelp(true);
    else await install();
  };
  const current = allItems.find((i) => i.to === pathname);

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* ---------- desktop sidebar ---------- */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border/70 px-4 py-5 lg:flex print:hidden">
        <Logo className="px-2" />
        <nav className="mt-8 flex-1 space-y-6 overflow-y-auto no-scrollbar">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                {g.label}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <SideLink item={item} active={pathname === item.to} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <button
          onClick={() => setHidden(!hidden)}
          aria-pressed={hidden}
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {hidden ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          {hidden ? "Show amounts" : "Hide amounts"}
        </button>
        {installMode && (
          <button
            onClick={onInstall}
            className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/15"
          >
            <Download className="size-4 text-primary" />
            <span>
              <span className="block font-medium">Install KudiLens</span>
              <span className="block text-xs text-muted-foreground">
                Opens like an app, full screen
              </span>
            </span>
          </button>
        )}
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {initials(user.email)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {user.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Sign out"
            className="size-9 sm:size-9"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      {/* ---------- phone / tablet top bar ---------- */}
      <header className="glass sticky top-0 z-30 border-b border-border/60 pt-safe lg:hidden print:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-safe">
          <Logo />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHidden(!hidden)}
              aria-pressed={hidden}
              aria-label={hidden ? "Show amounts" : "Hide amounts"}
            >
              {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </Button>
            {installMode && (
              <Button variant="ghost" size="icon" onClick={onInstall} aria-label="Install app">
                <Download className="size-5" />
              </Button>
            )}
            <Link
              to="/settings"
              aria-label="Settings"
              className="grid size-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
            >
              {initials(user.email)}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-safe pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
        <RateBar userId={user.id} />
        {current && (
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-primary lg:hidden">
            {current.label}
          </p>
        )}
        <div key={`${pathname}:${hidden}`} className="mt-3 animate-rise lg:mt-4">
          {children}
        </div>
      </main>

      {/* ---------- phone / tablet bottom tabs ---------- */}
      <nav
        aria-label="Main"
        className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border/60 pb-safe lg:hidden print:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5 px-2">
          {tabItems.map((item) => (
            <li key={item.to}>
              <TabLink item={item} active={pathname === item.to} />
            </li>
          ))}
          <li>
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                moreItems.some((i) => i.to === pathname) && "text-primary",
              )}
            >
              <MoreHorizontal className="size-[22px]" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-left">More</SheetTitle>
          </SheetHeader>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {moreItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-2 py-4 text-xs font-medium transition-colors hover:bg-accent",
                    pathname === item.to && "border-primary/40 text-primary",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2">
            {installMode && (
              <Button variant="outline" className="w-full" onClick={onInstall}>
                <Download /> Install KudiLens
              </Button>
            )}
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={iosHelp} onOpenChange={setIosHelp}>
        <SheetContent side="bottom" className="mx-auto max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-left">Install KudiLens on your iPhone</SheetTitle>
          </SheetHeader>
          <ol className="mt-2 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                <Share className="size-4" />
              </span>
              Tap the Share button in Safari's toolbar.
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                <SquarePlus className="size-4" />
              </span>
              Choose “Add to Home Screen”, then tap Add.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            KudiLens then opens full screen from your Home Screen like any other app.
          </p>
        </SheetContent>
      </Sheet>

      <InstallBanner mode={installMode} onInstall={onInstall} />
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-primary/12 text-foreground",
      )}
    >
      <item.icon className={cn("size-[18px] transition-colors", active && "text-primary")} />
      {item.label}
      {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
        active && "text-primary",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-12 place-items-center rounded-full transition-colors",
          active && "bg-primary/15",
        )}
      >
        <item.icon className="size-[20px]" />
      </span>
      {item.label}
    </Link>
  );
}

const BANNER_KEY = "kudi-install-dismissed";

/** One-time nudge on phones; dismissing it hides it for 30 days. */
function InstallBanner({
  mode,
  onInstall,
}: {
  mode: "prompt" | "ios" | null;
  onInstall: () => void;
}) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(BANNER_KEY) ?? 0);
      setHidden(Date.now() - at < 30 * 86_400_000);
    } catch {
      setHidden(false);
    }
  }, []);
  if (!mode || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(BANNER_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-rise lg:hidden print:hidden">
      <div className="panel flex items-center gap-3 p-3 pr-2">
        <img src="/icons/icon.svg" alt="" className="size-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Get the KudiLens app</p>
          <p className="truncate text-xs text-muted-foreground">
            Faster, full screen, right on your home screen
          </p>
        </div>
        <Button size="sm" onClick={onInstall}>
          Install
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 sm:size-9"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
