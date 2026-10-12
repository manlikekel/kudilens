import { createFileRoute } from "@tanstack/react-router";
import { guessMapping, parseCSV, type ParsedTable } from "@/lib/finance";
import { AIError, authed, errorResponse } from "@/lib/ai.server";

const MAX_BYTES = 8 * 1024 * 1024;

/** Reads a PDF statement with a vision model and returns it as a table (no amounts are logged). */
async function pdfToTable(base64: string, filename: string): Promise<ParsedTable> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AIError(500, "AI is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract every transaction row from this Nigerian bank statement. Return JSON {"headers":["Date","Description","Debit","Credit","Balance"],"rows":[[...]]}. Copy values exactly as printed; leave a cell "" when empty. Skip opening/closing balance and summary rows.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Statement attached." },
            { type: "file", file: { filename, file_data: `data:application/pdf;base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`PDF extraction failed [${res.status}]`);
    throw new AIError(res.status === 402 || res.status === 429 ? res.status : 502, res.status === 402 ? "AI credits are used up." : "Could not read that PDF. Try the CSV/Excel export from your bank instead.");
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new AIError(502, "Could not find any transactions in that PDF.");
  const t = JSON.parse(m[0]) as ParsedTable;
  return { headers: (t.headers ?? []).map(String), rows: (t.rows ?? []).map((r) => r.map((c) => String(c ?? ""))) };
}

export const Route = createFileRoute("/api/statements")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authed(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        try {
          const body = (await request.json()) as { kind: "csv" | "pdf"; text?: string; base64?: string; filename?: string };
          const size = (body.text ?? body.base64 ?? "").length;
          if (!size) return new Response("Empty file", { status: 400 });
          if (size > MAX_BYTES * 1.4) return new Response("File is too large (max 8 MB).", { status: 413 });
          const table = body.kind === "pdf" ? await pdfToTable(body.base64 ?? "", body.filename ?? "statement.pdf") : parseCSV(body.text ?? "");
          if (!table.headers.length || !table.rows.length) return new Response("No transaction rows found in that file.", { status: 422 });
          return Response.json({ ...table, mapping: guessMapping(table.headers) });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
