import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useFinance } from "@/lib/useFinance";
import { countryByCode, countryFromCurrency, type CountryCode } from "./directory";

/**
 * The user's investing country. Saved on the account (auth user metadata) so it follows them
 * across devices without a schema change; until they pick one we guess from the base currency.
 */
export function useCountry() {
  const { user } = useAuth();
  const { data } = useFinance(user?.id);
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const saved = (user?.user_metadata as { country?: string } | undefined)?.country;
  const code: CountryCode =
    countryByCode(saved)?.code ?? countryFromCurrency(data?.profile?.base_currency);

  async function setCountry(next: CountryCode) {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { country: next } });
    setSaving(false);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["finance", user?.id] });
  }

  return {
    code,
    country: countryByCode(code)!,
    chosen: !!countryByCode(saved),
    setCountry,
    saving,
  };
}
