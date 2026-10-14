import { afterEach, describe, expect, it } from "vitest";
import { formatMoney } from "./fx";
import { setAmountsHidden } from "./mask";

describe("privacy mode", () => {
  afterEach(() => setAmountsHidden(false));
  it("hides amounts but keeps the currency symbol", () => {
    setAmountsHidden(true);
    expect(formatMoney(1_234_567, "NGN")).toBe("₦•••");
    expect(formatMoney(99, "USD", { compact: false })).toBe("$•••");
  });
  it("shows amounts when off", () => {
    expect(formatMoney(1500, "NGN", { compact: false })).toContain("1,500");
  });
});
