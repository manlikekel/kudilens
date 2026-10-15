import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_USER, guardWrites, isDemo } from "@/lib/demo";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // demo mode is known from the first client render, so there's never a moment where the app
  // thinks it's signed out and redirects; `mounted` keeps the first render identical to SSR
  const [demo] = useState(() => typeof window !== "undefined" && isDemo());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (demo) guardWrites();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [demo]);

  // demo mode: a stand-in user so the app opens with sample data and no account
  const user: User | null = session?.user ?? (demo ? DEMO_USER : null);
  return { session, user, loading: demo && !session ? !mounted : loading };
}
