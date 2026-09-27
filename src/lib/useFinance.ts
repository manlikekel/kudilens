import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CashFlow, Debt, FamilyMember, FinanceData, Investment, Profile } from "./finance";

async function loadFinance(userId: string): Promise<FinanceData> {
  const [profile, debts, investments, flows, family] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("debts").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("investments").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("cash_flows").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("family_members").select("*").eq("user_id", userId).order("created_at"),
  ]);
  const err =
    profile.error || debts.error || investments.error || flows.error || family.error;
  if (err) throw new Error(err.message);
  return {
    profile: (profile.data as Profile | null) ?? null,
    debts: (debts.data ?? []) as Debt[],
    investments: (investments.data ?? []) as Investment[],
    flows: (flows.data ?? []) as CashFlow[],
    family: (family.data ?? []) as FamilyMember[],
  };
}

export function useFinance(userId: string | undefined) {
  return useQuery({
    queryKey: ["finance", userId],
    queryFn: () => loadFinance(userId!),
    enabled: !!userId,
  });
}

type TableName = "debts" | "investments" | "cash_flows" | "family_members";

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
