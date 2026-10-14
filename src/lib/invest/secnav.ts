/**
 * Reader for the SEC Nigeria "Weekly Valuation Report of Collective Investment Schemes" (.xlsx).
 * An .xlsx is a zip of XML files; we unzip with the platform's DecompressionStream (works in
 * Cloudflare Workers, browsers and Node 18+) so no extra dependency is needed.
 */

export interface NgFund {
  name: string;
  manager: string;
  /** section in the report, e.g. "Money Market Funds", "Dollar Funds" */
  category: string;
  /** NAV in Naira */
  nav: number | null;
  /** bid price per unit, Naira (or the dollar price for dollar funds) */
  price: number | null;
  priceCurrency: "NGN" | "USD";
  unitholders: number | null;
  /** week-to-date and year-to-date yield as decimals (money market funds report an annualised yield) */
  yieldWtd: number | null;
  yieldYtd: number | null;
}

export interface NgFundReport {
  weekEnded: string | null; // e.g. "October 2, 2026"
  funds: NgFund[];
}

/* ---------------- zip ---------------- */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extracts the named entries from a zip (stored or deflated). */
export async function unzip(
  bytes: Uint8Array,
  wanted: (name: string) => boolean,
): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // end of central directory record: scan back from the end for its signature
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Bad zip directory");
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;
    const lNameLen = view.getUint16(local + 26, true);
    const lExtraLen = view.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);
    const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (data) out.set(name, dec.decode(data));
  }
  return out;
}

/* ---------------- sheet ---------------- */

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

export function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unescape([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")).trim(),
  );
}

/** Rows as { columnLetter: value } maps. */
export function sheetRows(xml: string, strings: string[]): Record<string, string>[] {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row: Record<string, string> = {};
    for (const c of r[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] ?? "").match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = (c[3] ?? "").match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
      if (v == null && inline == null) continue;
      row[c[1]!] = /t="s"/.test(c[2]!)
        ? (strings[Number(v)] ?? "")
        : unescape(v ?? inline ?? "").trim();
    }
    return row;
  });
}

const num = (s: string | undefined) => {
  if (s == null || s === "" || /n\/?a/i.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/complaint/g, "compliant") // typo in some SEC reports
    .replace(/shari'ah/g, "shariah")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bEtfs?\b/g, (m) => m.toUpperCase());

/**
 * Parses the "Weekly Valuation" sheet. The current week sits in columns N–W:
 * N NAV ($), O NAV (₦), Q/R bid price ($/₦), U unitholders, V yield WTD, W yield YTD.
 * Each fund group ends with a "Sub-Total" row; not every group has a heading row, so group
 * names come from `sections` (the "NAV Comparison" sheet lists them in the same order).
 * Headings inside a group (e.g. "EUROBONDS", "FIXED INCOME") become sub-categories.
 */
export function parseValuation(
  rows: Record<string, string>[],
  sections: string[] = [],
): NgFundReport {
  const title = rows.find((r) => /WEEKLY VALUATION REPORT/i.test(r["A"] ?? ""))?.["A"] ?? "";
  const weekEnded = title.match(/ENDED\s+(?:[A-Z]+,\s*)?(.+)$/i)?.[1]?.trim() ?? null;
  const norm = (x: string) =>
    x
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .replace(/S$/, "");
  const sectionKeys = new Set(sections.map(norm));
  const funds: NgFund[] = [];
  let block = 0;
  let sub = "";
  let etf = false;
  for (const r of rows) {
    const a = r["A"] ?? "";
    const b = r["B"] ?? "";
    const c = r["C"] ?? "";
    if (/sub-?total/i.test(c)) {
      block++;
      sub = "";
      continue;
    }
    if (!a && b && !c && /^[A-Z0-9 '/&().-]+$/i.test(b) && !/[a-z]{4}/.test(b)) {
      if (/EXCHANGE\s+TRADED/i.test(b)) etf = true;
      else if (!sectionKeys.has(norm(b))) sub = titleCase(b);
      continue;
    }
    if (!/^\d+$/.test(a) || !b) continue;
    const group = etf
      ? "Exchange Traded Funds"
      : sections[block]
        ? titleCase(sections[block]!)
        : "Other";
    const usdPrice = num(r["Q"]);
    funds.push({
      name: b,
      manager: c,
      category: sub ? `${group} · ${sub}` : group,
      nav: num(r["O"]),
      price: usdPrice ?? num(r["R"]),
      priceCurrency: usdPrice != null ? "USD" : "NGN",
      unitholders: num(r["U"]),
      yieldWtd: num(r["V"]),
      yieldYtd: num(r["W"]),
    });
  }
  return { weekEnded, funds };
}

/** Group names in report order from the "NAV Comparison" sheet (first block of rows). */
export function sectionNames(rows: Record<string, string>[]): string[] {
  const names: string[] = [];
  for (const r of rows) {
    const name = (r["A"] ?? "").trim();
    // data rows have a number in column B; skip the header and stop when the list repeats
    if (!name || num(r["B"]) == null) continue;
    if (names.includes(name)) break;
    names.push(name);
  }
  return names;
}

/** Full pipeline from the downloaded .xlsx bytes. */
export async function readValuationReport(bytes: Uint8Array): Promise<NgFundReport> {
  const files = await unzip(
    bytes,
    (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet[12]\.xml$/.test(n),
  );
  const sheet = files.get("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("Report has no valuation sheet");
  const strings = sharedStrings(files.get("xl/sharedStrings.xml") ?? "");
  const sections = sectionNames(sheetRows(files.get("xl/worksheets/sheet2.xml") ?? "", strings));
  return parseValuation(sheetRows(sheet, strings), sections);
}
