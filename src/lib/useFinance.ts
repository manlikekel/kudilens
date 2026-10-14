import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { actualSpendNGN } from "./finance";
import type {
  Account,
  Asset,
  CashFlow,
  Debt,
  FamilyMember,
  FinanceData,
  FxRateRow,
  Goal,
  Investment,
  LumpCost,
  MarketAssumptions,
  Profile,
} from "./finance";

const DAY_MS = 86_400_000;

/**
 * Backstop for the daily cron: if the newest official rate is over a day old, ask the server to
 * refresh and return the new rows. Any failure keeps the rates we already have.
 */
async function freshRates(rows: FxRateRow[]): Promise<FxRateRow[]> {
  const newest = Math.max(0, ...rows.map((r) => new Date(r.as_of).getTime()));
  if (Date.now() - newest < DAY_MS) return rows;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return rows;
    const res = await fetch("/api/public/hooks/refresh-fx", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return rows;
    const again = await supabase.from("fx_rates").select("*");
    return again.error ? rows : ((again.data ?? []) as FxRateRow[]);
  } catch {
    return rows;
  }
}

async function loadFinance(userId: string): Promise<FinanceData> {
  const [profile, debts, investments, flows, family, goals, lumps, accounts, assets, fx, txns] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("debts").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("investments").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("cash_flows").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("family_members").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("goals").select("*").eq("user_id", userId).order("target_year"),
      supabase.from("lump_costs").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("accounts").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("assets").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("fx_rates").select("*"),
      supabase
        .from("transactions")
        .select("txn_date, amount_minor, category, currency")
        .eq("user_id", userId)
        .gte("txn_date", new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)),
    ]);
  const err =
    profile.error ||
    debts.error ||
    investments.error ||
    flows.error ||
    family.error ||
    goals.error ||
    lumps.error ||
    accounts.error ||
    assets.error ||
    fx.error ||
    txns.error;
  if (err) {
    console.error("Could not load finance data", err);
    throw new Error(err.message);
  }
  const [fxRates, market] = await Promise.all([
    freshRates((fx.data ?? []) as FxRateRow[]),
    liveMarket(),
  ]);
  return {
    profile: (profile.data as Profile | null) ?? null,
    debts: (debts.data ?? []) as Debt[],
    investments: (investments.data ?? []) as Investment[],
    flows: (flows.data ?? []) as CashFlow[],
    family: (family.data ?? []) as FamilyMember[],
    goals: (goals.data ?? []) as Goal[],
    lumps: (lumps.data ?? []) as LumpCost[],
    accounts: (accounts.data ?? []) as Account[],
    assets: (assets.data ?? []) as Asset[],
    fxRates,
    ...(market ? { market } : {}),
    actualSpend: actualSpendNGN(
      txns.data ?? [],
      fxRates,
      ((profile.data as Profile | null)?.fx_overrides as Record<string, unknown>) ?? {},
    ),
  };
}

/** True unless the user switched "Fill from live data" off (saved on their account). */
export async function liveAssumptionsOn() {
  const { data } = await supabase.auth.getSession();
  const meta = data.session?.user.user_metadata as { live_assumptions?: boolean } | undefined;
  return meta?.live_assumptions !== false;
}

/** Live inflation, Naira loss, etc. when the user has them on; undefined otherwise or on failure. */
async function liveMarket(): Promise<MarketAssumptions | undefined> {
  if (!(await liveAssumptionsOn())) return undefined;
  try {
    const res = await fetch("/api/market");
    return res.ok ? ((await res.json()) as MarketAssumptions) : undefined;
  } catch {
    return undefined;
  }
}

/** Live market values (always fetched, for showing next to the user's own numbers). */
export function useMarket() {
  return useQuery({
    queryKey: ["market"],
    queryFn: async () => {
      const res = await fetch("/api/market");
      if (!res.ok) throw new Error(`Live data unavailable (${res.status})`);
      return (await res.json()) as MarketAssumptions;
    },
    staleTime: 3600_000,
  });
}

export function useLiveAssumptions(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.auth.updateUser({ data: { live_assumptions: on } });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", userId] }),
  });
}

export function useFinance(userId: string | undefined) {
  return useQuery({
    queryKey: ["finance", userId],
    queryFn: () => loadFinance(userId!),
    enabled: !!userId,
  });
}

export type TableName =
  | "transactions"
  | "category_rules"
  | "debts"
  | "investments"
  | "cash_flows"
  | "family_members"
  | "goals"
  | "lump_costs"
  | "accounts"
  | "assets";

export function useUpsertRow(table: TableName, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const payload = { ...row, user_id: userId };
      const { error } = await supabase.from(table).upsert(payload as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", userId] }),
  });
}

export function useDeleteRow(table: TableName, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", userId] }),
  });
}

export function useSaveProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { error } = await supabase.from("profiles").upsert({ ...row, id: userId } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", userId] }),
  });
}
