import { PLATFORMS, type CountryCode } from "./directory";

export interface GoalPlan {
  /** what kind of product suits this goal */
  vehicle: string;
  why: string;
  /** a matching key from SAVINGS_VEHICLES, so the goal's odds can be recalculated with it */
  savedIn: string;
  /** licensed platforms in the user's country that offer it */
  platforms: string[];
  /** set when the goal is currently kept somewhere that doesn't suit its timeline */
  warning?: string;
}

const HOME: Record<CountryCode, string> = { NG: "NGN", US: "USD", GB: "GBP", CA: "CAD" };

/** Platforms in `country` whose offer mentions any of `words`. */
function offering(country: CountryCode, words: RegExp, limit = 3) {
  return PLATFORMS[country]
    .filter((p) => words.test(p.offers) && !/not confirmed/i.test(p.licence))
    .slice(0, limit)
    .map((p) => p.name);
}

/**
 * Where to keep the money for a goal, by how soon it's needed and which currency it's priced in.
 * Short goals need safety; long goals can ride out swings for growth; goals priced in a foreign
 * currency should be saved in that currency so a weaker home currency doesn't push them away.
 */
export function goalPlan(
  goal: { currency: string; saved_in?: string | null },
  monthsLeft: number,
  country: CountryCode,
): GoalPlan {
  const foreign = goal.currency !== HOME[country];
  const years = monthsLeft / 12;
  let plan: GoalPlan;

  if (country === "NG" && foreign) {
    plan = {
      vehicle:
        years < 1 ? "Dollar savings or a dollar money market fund" : "Dollar (Eurobond) fund",
      why: `This goal is priced in ${goal.currency}. Saving in dollars means a weaker Naira doesn't make it harder to reach.`,
      savedIn: years < 1 ? "usd savings" : "usd eurobond",
      platforms: offering("NG", /dollar|eurobond/i),
    };
  } else if (years < 1) {
    plan = {
      vehicle:
        country === "NG"
          ? "Money market fund or high-interest savings"
          : "High-interest savings or money market fund",
      why: "You need this money within a year, so keep it safe and easy to reach rather than in anything that can fall.",
      savedIn: "money market",
      platforms: offering(country, /money market|savings|cash/i),
    };
  } else if (years < 3) {
    plan = {
      vehicle:
        country === "NG"
          ? "Fixed income fund or Treasury bills"
          : "Bond fund or fixed-term deposit",
      why: "One to three years away: a bit more return than cash, with only small ups and downs.",
      savedIn: country === "NG" ? "t-bills" : "bonds",
      platforms: offering(country, /fixed income|bond|t-bill|GIC/i),
    };
  } else if (years < 5) {
    plan = {
      vehicle: "Balanced fund (stocks and bonds)",
      why: "Three to five years gives time to recover from a bad year, so some stocks can lift returns.",
      savedIn: "bonds",
      platforms: offering(country, /balanced|portfolio|funds/i),
    };
  } else {
    plan = {
      vehicle: country === "NG" ? "Equity fund or global index ETF" : "Global stock index fund",
      why: "Five or more years away: stocks have historically grown the most over long periods, despite swings.",
      savedIn: "stocks",
      platforms: offering(country, /equity|stocks|ETF/i),
    };
  }

  const current = goal.saved_in ?? "";
  if (years >= 5 && /money market|savings account|usd savings/.test(current))
    plan.warning =
      "Kept in cash-like savings for 5+ years, this goal may not keep up with inflation.";
  else if (years < 1 && /stocks/.test(current))
    plan.warning =
      "Stocks can drop just before you need the money. Consider moving it somewhere safer now.";
  else if (country === "NG" && foreign && !/usd/.test(current))
    plan.warning = `Saved in Naira for a ${goal.currency} goal, so every fall in the Naira moves the target further away.`;
  return plan;
}
