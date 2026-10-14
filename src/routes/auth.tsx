import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, ShieldCheck, Target } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — KudiLens personal finance analyst" },
      {
        name: "description",
        content:
          "Sign in to KudiLens to track debts, investments, income and family costs, and get data-driven money insights.",
      },
      { property: "og:title", content: "Sign in — KudiLens" },
      {
        property: "og:description",
        content: "Your private financial analyst for debts, investments and long-term projections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try email instead.");
      return;
    }
  }

  async function forgot() {
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) toast.error(error.message);
    else
      toast.success(
        `If ${email} has an account, a reset link is on its way. It opens Settings to pick a new password.`,
      );
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="hero-surface relative hidden overflow-hidden p-12 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <img src="/icons/icon.svg" alt="" className="size-9 rounded-xl" />
          <span className="font-display text-lg font-semibold tracking-tight">KudiLens</span>
        </div>
        <div className="my-auto max-w-lg">
          <h1 className="text-5xl font-semibold leading-[1.05]">
            See your whole financial picture.
            <span className="block text-[oklch(0.85_0.14_163)]">Then change it.</span>
          </h1>
          <p className="mt-5 text-lg text-white/70">
            Debts, investments, family costs and goals in one place, with forecasts and advice built
            from your own numbers.
          </p>
          <ul className="mt-10 space-y-4">
            {[
              [LineChart, "25-year net worth and investment forecasts"],
              [Target, "Goal odds, debt payoff plans and what-ifs"],
              [ShieldCheck, "Private to your account. Nobody else sees your numbers"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof LineChart;
              return (
                <li key={text as string} className="flex items-center gap-3 text-white/85">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/10">
                    <I className="size-4" />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-white/50">
          Educational insights, not licensed financial advice.
        </p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-[oklch(0.8_0.15_163/0.18)] blur-3xl" />
      </aside>

      <main className="flex flex-col items-center justify-center px-safe py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img src="/icons/icon.svg" alt="" className="size-16 rounded-2xl shadow-lg" />
            <p className="mt-4 font-display text-2xl font-semibold tracking-tight">
              Kudi<span className="text-primary">Lens</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Your private money analyst</p>
          </div>

          <h2 className="text-2xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to see your numbers."
              : "It takes a minute. Your data stays private."}
          </p>

          <Button variant="outline" className="mt-6 w-full" onClick={google}>
            <GoogleMark /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={forgot}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                minLength={6}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  );
}
