import { summarize, type FinanceData } from "./core";
import { roundMoney } from "./money";

export interface Snapshot {
  month: string; // YYYY-MM-01
  currency: string;
  net_worth: number;
  investments: number;
  cash: number;
  assets: number;
  debt: number;
  updated_at?: string;
}

/** First day of the month as YYYY-MM-01 (local calendar). */
export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** This month's snapshot of the balance sheet, in the user's base currency. */
export function snapshotOf(data: FinanceData, today = new Date()): Snapshot {
  const s = summarize(data);
  return {
    month: monthKey(today),
    currency: s.currency,
    net_worth: roundMoney(s.netWorth),
    investments: roundMoney(s.totalInvested),
    cash: roundMoney(s.totalAccounts),
    assets: roundMoney(s.totalAssets),
    debt: roundMoney(s.totalDebt),
  };
}

export function sameSnapshot(a: Snapshot | undefined, b: Snapshot) {
  return (
    !!a &&
    a.month === b.month &&
    a.currency === b.currency &&
    (["net_worth", "investments", "cash", "assets", "debt"] as const).every(
      (k) => Math.round(Number(a[k])) === Math.round(b[k]),
    )
  );
}

export interface CheckInSummary {
  since: string; // month of the comparison snapshot
  netWorth: number;
  debt: number;
  investments: number;
  cash: number;
}

/** Change from the latest earlier month to the current one (same currency only). */
export function checkInSummary(history: Snapshot[], current: Snapshot): CheckInSummary | null {
  const prev = [...history]
    .filter((h) => h.month < current.month && h.currency === current.currency)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  if (!prev) return null;
  return {
    since: prev.month,
    netWorth: current.net_worth - Number(prev.net_worth),
    debt: current.debt - Number(prev.debt),
    investments: current.investments - Number(prev.investments),
    cash: current.cash - Number(prev.cash),
  };
}

/** A monthly calendar reminder (iCalendar) on the 1st at 9am, for the check-in. */
export function checkInCalendar(appUrl: string, now = new Date()): string {
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const end = new Date(start.getTime() + 15 * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KudiLens//Monthly check-in//EN",
    "BEGIN:VEVENT",
    `UID:kudilens-checkin-${start.getTime()}@kudilens`,
    `DTSTAMP:${fmt(now)}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=1",
    "SUMMARY:KudiLens monthly money check-in",
    `DESCRIPTION:Update your balances and see how your net worth moved this month. ${appUrl}`,
    `URL:${appUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:KudiLens check-in",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
