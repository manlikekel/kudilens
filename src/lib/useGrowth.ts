import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sameSnapshot, snapshotOf, type FinanceData, type Snapshot } from "@/lib/finance";

/**
 * Hooks for the tables added in migration 0005 (snapshots, budgets, scenarios). Until that
 * migration is applied the tables don't exist; callers get `missing: true` and show a notice
 * instead of an error.
 */

export const isMissingTable = (message: string | undefined) =>
  !!message &&
  /does not exist|schema cache|could not find the table|relation .* does not exist/i.test(message);

export class MissingTableError extends Error {}

async function rows<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error)
    throw isMissingTable(error.message)
      ? new MissingTableError(error.message)
      : new Error(error.message);
  return (data ?? []) as T[];
}

export function useSnapshots(userId: string | undefined) {
  const q = useQuery({
    queryKey: ["snapshots", userId],
    enabled: !!userId,
    retry: (n, e) => !(e instanceof MissingTableError) && n < 2,
    queryFn: () =>
      rows<Snapshot>(
        supabase.from("net_worth_snapshots").select("*").eq("user_id", userId!).order("month"),
      ),
  });
  return { ...q, missing: q.error instanceof MissingTableError };
}

/** Saves (or refreshes) this month's snapshot when the balance sheet has changed. */
export function useRecordSnapshot(userId: string | undefined, data: FinanceData | undefined) {
  const { data: history, missing } = useSnapshots(userId);
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId || !data || !history || missing) return;
    const snap = snapshotOf(data);
    if (
      sameSnapshot(
        history.find((h) => h.month === snap.month),
        snap,
      )
    )
      return;
    void supabase
      .from("net_worth_snapshots")
      .upsert(
        { ...snap, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: "user_id,month" },
      )
      .then(({ error }) => {
        if (!error) void qc.invalidateQueries({ queryKey: ["snapshots", userId] });
      });
  }, [userId, data, history, missing, qc]);
}

export interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  currency: string;
}

export function useBudgets(userId: string | undefined) {
  const q = useQuery({
    queryKey: ["budgets", userId],
    enabled: !!userId,
    retry: (n, e) => !(e instanceof MissingTableError) && n < 2,
    queryFn: () =>
      rows<Budget>(supabase.from("budgets").select("*").eq("user_id", userId!).order("category")),
  });
  return { ...q, missing: q.error instanceof MissingTableError };
}

export function useSaveBudget(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { category: string; monthly_limit: number; currency: string }) => {
      const { error } =
        b.monthly_limit > 0
          ? await supabase
              .from("budgets")
              .upsert({ ...b, user_id: userId! }, { onConflict: "user_id,category" })
          : await supabase
              .from("budgets")
              .delete()
              .eq("user_id", userId!)
              .eq("category", b.category);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets", userId] }),
  });
}

export interface ScenarioRow {
  id: string;
  name: string;
  changes: unknown;
  created_at: string;
}

export function useScenarios(userId: string | undefined) {
  const q = useQuery({
    queryKey: ["scenarios", userId],
    enabled: !!userId,
    retry: (n, e) => !(e instanceof MissingTableError) && n < 2,
    queryFn: () =>
      rows<ScenarioRow>(
        supabase.from("scenarios").select("*").eq("user_id", userId!).order("created_at"),
      ),
  });
  return { ...q, missing: q.error instanceof MissingTableError };
}

export function useSaveScenario(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { id?: string; name: string; changes: unknown }) => {
      const { error } = await supabase
        .from("scenarios")
        .upsert({ ...s, user_id: userId!, changes: s.changes as never });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios", userId] }),
  });
}

export function useDeleteScenario(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scenarios").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios", userId] }),
  });
}

export interface RecentTxn {
  txn_date: string;
  amount_minor: number;
  category: string;
  currency: string;
  merchant: string;
}

/** The last ~4 months of transactions: enough for this month's spending and recurring bills. */
export function useRecentTxns(userId: string | undefined) {
  return useQuery({
    queryKey: ["recent-txns", userId],
    enabled: !!userId,
    queryFn: () =>
      rows<RecentTxn>(
        supabase
          .from("transactions")
          .select("txn_date, amount_minor, category, currency, merchant")
          .eq("user_id", userId!)
          .gte("txn_date", new Date(Date.now() - 125 * 86_400_000).toISOString().slice(0, 10)),
      ),
  });
}
