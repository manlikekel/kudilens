import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORIES } from "@/lib/finance";
import { cn } from "@/lib/utils";

type Kind = "spent" | "received" | "debt";

/** Floating button to log one transaction by hand from any page. */
export function QuickAdd({ userId, currency }: { userId: string; currency: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("spent");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const pickKind = (k: Kind) => {
    setKind(k);
    setCategory(k === "received" ? "Salary" : k === "debt" ? "Debt repayment" : "Groceries");
  };

  const save = async () => {
    const n = Number(amount.replace(/,/g, ""));
    if (!(n > 0)) {
      toast.error("Enter an amount above zero");
      return;
    }
    setSaving(true);
    const minor = Math.round(n * 100) * (kind === "received" ? 1 : -1);
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      txn_date: date,
      amount_minor: minor,
      currency,
      merchant: note.trim() || category,
      description: note.trim() || null,
      category,
      source: "manual",
      dedupe_key: `manual-${crypto.randomUUID()}`,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    toast.success("Added");
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
                    "rounded-xl border border-border py-2 text-sm",
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
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="qa-date">Date</Label>
                <Input id="qa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="qa-note">Note (optional)</Label>
              <Input id="qa-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Shoprite" />
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
