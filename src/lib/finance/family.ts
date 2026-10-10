import type { FinanceData } from "./core";
import { getAssumptions } from "./assumptions";

export type Stage = "none" | "nursery" | "primary" | "secondary" | "university" | "done";

/** Today's yearly fees per stage. NGN local private school; USD for studying abroad. */
export const SCHOOL_FEES = {
  NGN: { nursery: 800_000, primary: 1_500_000, secondary: 2_500_000, university: 3_000_000 },
  USD: { nursery: 0, primary: 0, secondary: 0, university: 25_000 },
};

export function stageForAge(age: number): Stage {
  if (age < 2) return "none";
  if (age < 6) return "nursery";
  if (age < 12) return "primary";
  if (age < 18) return "secondary";
  if (age < 22) return "university";
  return "done";
}

export interface EducationYear {
  year: number;
  local: number; // NGN, all in-country
  abroad: number; // NGN, university abroad (USD fees converted at a depreciating rate)
}

export function educationForecast(data: FinanceData, years = 25): EducationYear[] {
  const a = getAssumptions(data);
  const kids = data.family.filter((m) => m.relationship === "child");
  const y0 = new Date().getFullYear();
  const out: EducationYear[] = [];
  for (let t = 0; t <= years; t++) {
    let local = 0;
    let abroad = 0;
    for (const k of kids) {
      const st = stageForAge(Number(k.age) + t);
      if (st === "none" || st === "done") continue;
      const ngn = SCHOOL_FEES.NGN[st] * Math.pow(1 + a.educationInflation, t);
      local += ngn;
      if (st === "university") {
        const usd = SCHOOL_FEES.USD.university * Math.pow(1.04, t);
        abroad += toNGN(usd, "USD", a) * Math.pow(1 + a.fxDepreciation, t);
      } else abroad += ngn;
    }
    out.push({ year: y0 + t, local, abroad });
  }
  return out;
}

export interface LifeEvent {
  year: number;
  label: string;
  kind: "school" | "debt" | "goal" | "retirement" | "maturity";
}

export function lifeEvents(
  data: FinanceData,
  debtPayoff: { name: string; month: number }[] = [],
): LifeEvent[] {
  const y0 = new Date().getFullYear();
  const events: LifeEvent[] = [];
  data.family
    .filter((m) => m.relationship === "child")
    .forEach((k, i) => {
      const who = `Child ${i + 1}`; // never expose names
      const at = (age: number, label: string) => {
        if (age >= Number(k.age)) events.push({ year: y0 + age - Number(k.age), label: `${who} ${label}`, kind: "school" });
      };
      at(6, "starts primary");
      at(12, "starts secondary");
      at(18, "starts university");
    });
  debtPayoff.forEach((d) =>
    events.push({ year: y0 + Math.floor(d.month / 12), label: `${d.name} paid off`, kind: "debt" }),
  );
  (data.goals ?? []).forEach((g) => events.push({ year: g.target_year, label: g.name, kind: "goal" }));
  data.investments
    .filter((i) => /t-?bill|maturity|matures/i.test(`${i.name} ${i.notes ?? ""}`))
    .forEach((i) => events.push({ year: y0, label: `${i.name} matures`, kind: "maturity" }));
  const p = data.profile;
  if (p?.age && p.retirement_age && p.retirement_age > p.age)
    events.push({ year: y0 + p.retirement_age - p.age, label: "Retirement", kind: "retirement" });
  return events.sort((a, b) => a.year - b.year);
}
