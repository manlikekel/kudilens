import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { actualSpendNGN } from "./finance";
import type { Account, Asset, CashFlow, Debt, FamilyMember, FinanceData, FxRateRow, Goal, Investment, LumpCost, Profile } from "./finance";

async function loadFinance(userId: string): Promise<FinanceData> {
  const [profile, debts, investments, flows, family, goals, lumps, accounts, assets, fx, txns] = await Promise.all([
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
    supabase.from("transactions").select("txn_date, amount_minor, category, currency").eq("user_id", userId).gte("txn_date", new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const err =
    profile.error || debts.error || investments.error || flows.error || family.error || goals.error || lumps.error ||
    accounts.error || assets.error || fx.error || txns.error;
  if (err) {
    console.error("Could not load finance data", err);
    throw new Error(err.message);
  }
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
    fxRates: (fx.data ?? []) as FxRateRow[],
    actualSpend: actualSpendNGN(txns.data ?? [], (fx.data ?? []) as FxRateRow[], ((profile.data as Profile | null)?.fx_overrides as Record<string, unknown>) ?? {}),
  };
}

export function useFinance(userId: string | undefined) {
  return useQuery({
    queryKey: ["finance", userId],
    queryFn: () => loadFinance(userId!),
    enabled: !!userId,
  });
}

export type TableName = "transactions" | "category_rules" | "debts" | "investments" | "cash_flows" | "family_members" | "goals" | "lump_costs" | "accounts" | "assets";

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
      const { error } = await supabase
        .from("profiles")
        .upsert({ ...row, id: userId } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", userId] }),
  });
}
