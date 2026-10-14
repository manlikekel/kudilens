import { useSyncExternalStore } from "react";
import { amountsHidden, onAmountsHiddenChange, setAmountsHidden } from "@/lib/finance/mask";

/** Privacy mode: hides every amount as "₦•••". Remembered on this device. */
export function usePrivacy(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(onAmountsHiddenChange, amountsHidden, () => false);
  return [value, setAmountsHidden];
}
