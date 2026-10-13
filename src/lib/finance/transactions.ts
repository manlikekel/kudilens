/**
 * Bank-statement parsing, categorisation rules, recurring detection and
 * monthly spending. Pure functions — no I/O. Amounts are integer minor units
 * (kobo/cents); spending is negative, money in is positive.
 */

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export interface ColumnMapping {
  date: number;
  description: number;
  /** Single signed amount column, or -1 when debit/credit columns are used. */
  amount: number;
  debit: number;
  credit: number;
}

export interface Txn {
  txn_date: string; // YYYY-MM-DD
  amount_minor: number;
  currency: string;
  merchant: string;
  description: string;
  category: string;
  is_recurring?: boolean;
  dedupe_key: string;
}

export interface CategoryRule {
  pattern: string;
  category: string;
}

export const CATEGORIES = [
  "Groceries", "Eating out", "Transport", "Fuel", "Rent & housing", "Utilities", "Airtime & data",
  "Subscriptions", "School fees", "Health", "Family support", "Shopping", "Bank charges", "Transfers",
  "Salary", "Other income", "Savings & investing", "Debt repayment", "Entertainment", "Uncategorised",
] as const;

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). Auto-detects , ; or tab. */
export function parseCSV(text: string): ParsedTable {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((x) => x !== "")) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) out.push(row);
  // Banks often put account info above the real header: pick the first row that looks like a header.
  const hi = out.findIndex((r) => r.some((x) => /date/i.test(x)) && r.some((x) => /(amount|debit|credit|withdrawal|deposit|narration|description|remarks|details)/i.test(x)));
  const start = hi >= 0 ? hi : 0;
  return { headers: out[start] ?? [], rows: out.slice(start + 1) };
}

/** Guesses columns from header names used by GTBank, Access, Zenith, UBA, First Bank, Kuda, Moniepoint, Opay. */
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (re: RegExp, not?: RegExp) => headers.findIndex((h) => re.test(h) && !(not && not.test(h)));
  return {
    date: find(/(trans(action)?\.? ?date|txn date|posted|date)/i, /value/i) >= 0 ? find(/(trans(action)?\.? ?date|txn date|posted|date)/i, /value/i) : find(/date/i),
    description: find(/(narration|description|remarks|details|particulars|transaction details|memo)/i),
    amount: find(/^(amount|amount \(.*\)|transaction amount)$/i),
    debit: find(/(debit|withdrawal|money out|dr\b|paid out)/i),
    credit: find(/(credit|deposit|lodgement|money in|cr\b|paid in)/i, /card/i),
  };
}

/** Parses "₦1,234.50", "(1,234.50)", "-1234", "1.234,50" → minor units. Empty → null. */
export function parseAmountMinor(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s || s === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\bDR$/i.test(s)) { neg = true; }
  s = s.replace(/[^\d.,-]/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  // European style "1.234,50"
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const minor = Math.round(n * 100);
  return neg ? -minor : minor;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Parses Nigerian bank date formats (day first) → YYYY-MM-DD, or null. */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fix = (y: number) => (y < 100 ? 2000 + y : y);
  const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,4})[-/. ,]*(\d{2,4})/);
  if (m && MONTHS[m[2]!.toLowerCase()]!) return valid(fix(+m[3]!), MONTHS[m[2]!.toLowerCase()]!, +m[1]!);
  m = s.match(/^([A-Za-z]{3,4})[-/. ](\d{1,2}),?[-/. ](\d{2,4})/);
  if (m && MONTHS[m[1]!.toLowerCase()]!) return valid(fix(+m[3]!), MONTHS[m[1]!.toLowerCase()]!, +m[2]!);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return valid(fix(+m[3]!), +m[2]!, +m[1]!); // day first
  return null;
}

/** Strips transfer/POS noise so "POS PURCHASE @ SHOPRITE IKEJA REF 1234" → "SHOPRITE IKEJA". */
export function cleanMerchant(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/@/g, " ").replace(/\b(POS|WEB|NIP|USSD|TRF|TRANSFER|PURCHASE|PAYMENT|PMT|FRM|FROM|TO|VIA|AT|@|REF|REFERENCE|SESSION|ID|NO)\b[:.]?/g, " ")
    .replace(/[A-Z]*\d{5,}[A-Z\d]*/g, " ")
    .replace(/[/|*#:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || desc.slice(0, 60);
}

/** Stable key so re-importing the same statement never duplicates rows. */
export function dedupeKey(date: string, amountMinor: number, description: string): string {
  const norm = description.toUpperCase().replace(/\s+/g, " ").trim();
  let h = 2166136261;
  for (const ch of `${date}|${amountMinor}|${norm}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return `${date}:${amountMinor}:${(h >>> 0).toString(36)}`;
}

/** Converts mapped rows into transactions; skips rows without a valid date or amount. */
export function rowsToTxns(table: ParsedTable, map: ColumnMapping, currency = "NGN", rules: CategoryRule[] = []): { txns: Txn[]; skipped: number } {
  const txns: Txn[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;
  for (const r of table.rows) {
    const date = parseDate(r[map.date]);
    let amt: number | null = null;
    if (map.amount >= 0) amt = parseAmountMinor(r[map.amount]);
    else {
      const d = parseAmountMinor(r[map.debit]);
      const c = parseAmountMinor(r[map.credit]);
      if (d) amt = -Math.abs(d);
      else if (c) amt = Math.abs(c);
    }
    if (!date || amt == null || amt === 0) { skipped++; continue; }
    const description = (r[map.description] ?? "").trim();
    let key = dedupeKey(date, amt, description);
    // Two identical lines on the same statement are real (e.g. two ₦100 airtime top-ups).
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n > 0) key = `${key}#${n}`;
    const merchant = cleanMerchant(description);
    txns.push({ txn_date: date, amount_minor: amt, currency, merchant, description, category: applyRules(merchant, description, amt, rules), dedupe_key: key });
  }
  return { txns, skipped };
}

const BUILT_IN: [RegExp, string][] = [
  [/SHOPRITE|SPAR|JUSTRITE|PRINCE ?EBEANO|MARKET|SUPERMARKET|GROCER/i, "Groceries"],
  [/CHICKEN REPUBLIC|KFC|DOMINO|DOMINOS|COLD ?STONE|RESTAURANT|EATERY|CHOWDECK|GLOVO|FOOD/i, "Eating out"],
  [/UBER|BOLT|TAXIFY|INDRIVE|RIDE/i, "Transport"],
  [/TOTAL ?ENERGIES|MRS|CONOIL|OANDO|NNPC|ARDOVA|FILLING|PETROL|FUEL/i, "Fuel"],
  [/DSTV|GOTV|MULTICHOICE|NETFLIX|SPOTIFY|SHOWMAX|APPLE\.COM|YOUTUBE|PRIME VIDEO|ICLOUD|CHATGPT|OPENAI/i, "Subscriptions"],
  [/MTN|AIRTEL|GLO\b|9MOBILE|AIRTIME|DATA ?(PLAN|BUNDLE)|SPECTRANET|SMILE|STARLINK/i, "Airtime & data"],
  [/IKEDC|EKEDC|AEDC|PHED|IBEDC|ELECTRIC|NEPA|PREPAID METER|WATER|LAWMA|ESTATE/i, "Utilities"],
  [/SCHOOL|ACADEMY|COLLEGE|UNIVERSITY|TUITION/i, "School fees"],
  [/HOSPITAL|PHARM|CLINIC|HMO|MEDIC|LAB/i, "Health"],
  [/SMS ALERT|CHARGE|COMMISSION|STAMP DUTY|VAT|MAINTENANCE FEE|FEE\b/i, "Bank charges"],
  [/SALARY|PAYROLL/i, "Salary"],
  [/RENT|LANDLORD/i, "Rent & housing"],
  [/LOAN|REPAYMENT|CARBON|FAIRMONEY|PALMCREDIT|RENMONEY/i, "Debt repayment"],
  [/COWRYWISE|PIGGYVEST|RISEVEST|BAMBOO|TROVE|CHAKA|T-?BILL|INVEST/i, "Savings & investing"],
  [/JUMIA|KONGA|AMAZON|ALIEXPRESS|MALL/i, "Shopping"],
  [/CINEMA|FILMHOUSE|BET9JA|SPORTYBET|BET ?KING|NAIRABET/i, "Entertainment"],
];

/** User rules first (case-insensitive substring), then built-in keyword rules, then sign-based fallback. */
export function applyRules(merchant: string, description: string, amountMinor: number, rules: CategoryRule[] = []): string {
  const hay = `${merchant} ${description}`.toUpperCase();
  for (const r of rules) if (r.pattern.trim() && hay.includes(r.pattern.trim().toUpperCase())) return r.category;
  for (const [re, cat] of BUILT_IN) if (re.test(hay)) return cat;
  if (/TRANSFER|TRF|NIP/i.test(description)) return amountMinor > 0 ? "Other income" : "Transfers";
  return amountMinor > 0 ? "Other income" : "Uncategorised";
}

export interface RecurringItem {
  merchant: string;
  category: string;
  typicalMinor: number; // positive monthly cost
  occurrences: number;
  lastDate: string;
  nextDate: string;
  isSubscription: boolean;
  annualMinor: number;
}

const SUBSCRIPTION = /DSTV|GOTV|NETFLIX|SPOTIFY|SHOWMAX|APPLE|YOUTUBE|PRIME|ICLOUD|CHATGPT|OPENAI|DATA|SPECTRANET|SMILE|STARLINK|GYM/i;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Finds outgoing payments to the same merchant roughly monthly (25–35 days) with similar amounts (±15%). */
export function detectRecurring(txns: Pick<Txn, "txn_date" | "amount_minor" | "merchant" | "category">[]): RecurringItem[] {
  const groups = new Map<string, typeof txns>();
  for (const t of txns) {
    if (t.amount_minor >= 0 || !t.merchant) continue;
    const k = t.merchant.split(" ").slice(0, 2).join(" ");
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out: RecurringItem[] = [];
  for (const [merchant, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.txn_date.localeCompare(b.txn_date));
    const amounts = sorted.map((t) => -t.amount_minor).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = sorted.filter((t) => Math.abs(-t.amount_minor - median) <= median * 0.15);
    if (similar.length < 2) continue;
    const gaps = similar.slice(1).map((t, i) => daysBetween(similar[i].txn_date, t.txn_date));
    const monthlyGaps = gaps.filter((g) => g >= 25 && g <= 35).length;
    if (monthlyGaps < Math.max(1, Math.ceil(gaps.length * 0.6))) continue;
    const last = similar[similar.length - 1];
    const next = new Date(Date.parse(last.txn_date) + 30 * 86_400_000).toISOString().slice(0, 10);
    out.push({
      merchant,
      category: last.category,
      typicalMinor: median,
      occurrences: similar.length,
      lastDate: last.txn_date,
      nextDate: next,
      isSubscription: SUBSCRIPTION.test(merchant) || last.category === "Subscriptions",
      annualMinor: median * 12,
    });
  }
  return out.sort((a, b) => b.annualMinor - a.annualMinor);
}

export interface MonthSpend {
  month: string; // YYYY-MM
  incomeMinor: number;
  spendMinor: number; // positive
  byCategory: Record<string, number>; // positive spend per category
}

/** Transfers between own accounts and savings are not "spending". */
const NOT_SPEND = new Set(["Transfers", "Savings & investing", "Debt repayment"]);

export function monthlySpending(txns: Pick<Txn, "txn_date" | "amount_minor" | "category">[]): MonthSpend[] {
  const map = new Map<string, MonthSpend>();
  for (const t of txns) {
    const month = t.txn_date.slice(0, 7);
    const m = map.get(month) ?? { month, incomeMinor: 0, spendMinor: 0, byCategory: {} };
    if (t.amount_minor > 0) m.incomeMinor += t.amount_minor;
    else if (!NOT_SPEND.has(t.category)) {
      m.spendMinor += -t.amount_minor;
      m.byCategory[t.category] = (m.byCategory[t.category] ?? 0) - t.amount_minor;
    }
    map.set(month, m);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Average monthly spend over the last N complete months (excludes the current partial month). */
export function averageActualSpend(months: MonthSpend[], today = new Date(), n = 3): { avgMinor: number; months: number } {
  const current = today.toISOString().slice(0, 7);
  const complete = months.filter((m) => m.month < current).slice(-n);
  if (!complete.length) return { avgMinor: 0, months: 0 };
  return { avgMinor: Math.round(complete.reduce((t, m) => t + m.spendMinor, 0) / complete.length), months: complete.length };
}

import { buildRates, convert, type FxRateRow } from "./fx";

/** Actual average monthly spend converted to Naira (major units) for the finance engine. */
export function actualSpendNGN(
  txns: Pick<Txn, "txn_date" | "amount_minor" | "category" | "currency">[],
  fxRows: FxRateRow[] = [],
  overrides: Record<string, unknown> = {},
  today = new Date(),
): { avgMonthly: number; months: number } {
  const rates = buildRates(fxRows, overrides);
  const ngn = txns.map((t) => ({ ...t, amount_minor: Math.round(convert(t.amount_minor, t.currency, "NGN", rates)) }));
  const { avgMinor, months } = averageActualSpend(monthlySpending(ngn), today);
  return { avgMonthly: avgMinor / 100, months };
}
