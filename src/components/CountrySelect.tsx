import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, type CountryCode } from "@/lib/invest/directory";
import { useCountry } from "@/lib/invest/useCountry";
import { cn } from "@/lib/utils";

/** Country picker shared by Settings and the Invest page; saving updates both. */
export function CountrySelect({ className }: { className?: string }) {
  const { code, setCountry, saving } = useCountry();
  return (
    <Select
      value={code}
      disabled={saving}
      onValueChange={async (v) => {
        try {
          await setCountry(v as CountryCode);
          toast.success(
            `Showing investing options for ${COUNTRIES.find((c) => c.code === v)?.name}.`,
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save your country.");
        }
      }}
    >
      <SelectTrigger
        className={cn("h-11 w-full rounded-xl sm:w-56", className)}
        aria-label="Country"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COUNTRIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="mr-2">{c.flag}</span>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
