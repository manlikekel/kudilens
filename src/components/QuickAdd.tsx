import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SPEND_CATEGORIES, convert, getRates, type FinanceData } from "@/lib/finance";
import { cn } from "@/lib/utils";

type Kind = "spent" | "received" | "debt";

const CATEGORY_OPTIONS: Record<Kind, readonly string[]> = {
  spent: SPEND_CATEGORIES,
  received: ["Salary", "Other income"],
  debt: ["Debt repayment"],
};

/** Floating button to log one transaction by hand from any page. */
export function QuickAdd({
  userId,
  currency,
  data,
}: {
  userId: string;
  currency: string;
  data?: FinanceData | undefined;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("spent");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const debts = (data?.debts ?? []).filter((d) => Number(d.balance) > 0);
  const [debtId, setDebtId] = useState("");

  const pickKind = (k: Kind) => {
    setKind(k);
    setCategory(k === "received" ? "Salary" : k === "debt" ? "Debt repayment" : "Groceries");
    if (k === "debt" && !debtId && debts[0]) setDebtId(debts[0].id);
  };

  const save = async () => {
    const n = Number(amount.replace(/,/g, ""));
    if (!(n > 0)) {
      toast.error("Enter an amount above zero");
      return;
    }
    const debt = kind === "debt" ? debts.find((d) => d.id === debtId) : undefined;
    setSaving(true);
    const minor = Math.round(n * 100) * (kind === "received" ? 1 : -1);
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      txn_date: date,
      amount_minor: minor,
      currency,
      merchant: note.trim() || debt?.name || category,
      description: note.trim() || null,
      category,
      source: "manual",
      dedupe_key: `manual-${crypto.randomUUID()}`,
    });
    if (error) {
      setSaving(false);
      toast.error("Could not save: " + error.message);
      return;
    }
    // a debt payment also lowers what's owed (converted into the debt's own currency)
    if (debt && data) {
      const paid = convert(n, currency, debt.currency, getRates(data));
      const balance = Math.max(0, Number(debt.balance) - paid);
      const { error: debtError } = await supabase
        .from("debts")
        .update({ balance })
        .eq("id", debt.id);
      if (debtError)
        toast.error("Saved the payment, but couldn't update the debt: " + debtError.message);
      else if (balance === 0) toast.success(`${debt.name} is paid off!`);
    }
    setSaving(false);
    toast.success(debt ? `Payment to ${debt.name} added` : "Added");
    setAmount("");
    setNote("");
    setOpen(false);
    void qc.invalidateQueries();
  };

  return (
    <>
      <button
        aria-label="Quick add"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:right-8 lg:bottom-8 print:hidden"
      >
        <Plus className="size-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-xl">
          <SheetHeader>
            <SheetTitle>Quick add</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["spent", "I spent"],
                  ["received", "I received"],
                  ["debt", "Paid a debt"],
                ] as [Kind, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => pickKind(k)}
                  className={cn(
                    "rounded-xl border border-border py-2.5 text-sm",
                    kind === k && "border-primary bg-primary/12 text-primary",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="qa-amount">Amount ({currency})</Label>
              <Input
                id="qa-amount"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="qa-cat">Category</Label>
                <select
                  id="qa-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm"
                >
                  {CATEGORY_OPTIONS[kind].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="qa-date">Date</Label>
                <Input
                  id="qa-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            {kind === "debt" && (
              <div>
                <Label htmlFor="qa-debt">Which debt?</Label>
                {debts.length ? (
                  <select
                    id="qa-debt"
                    value={debtId}
                    onChange={(e) => setDebtId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm"
                  >
                    <option value="">Not one of my debts</option>
                    {debts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">No open debts in My numbers.</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Its balance goes down by this amount.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="qa-note">Note (optional)</Label>
              <Input
                id="qa-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Shoprite"
              />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
