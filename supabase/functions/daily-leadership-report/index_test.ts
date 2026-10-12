import { dateInIndia, makePdf, previousWorkingDate } from "./index.ts";

Deno.test("report date follows Asia/Kolkata across UTC date boundary", () => {
  const beforeMidnightIndia = new Date("2026-10-11T18:29:00Z");
  const afterMidnightIndia = new Date("2026-10-11T18:31:00Z");
  if (dateInIndia(beforeMidnightIndia) !== "2026-10-11") throw new Error("Unexpected business date before India midnight");
  if (dateInIndia(afterMidnightIndia) !== "2026-10-12") throw new Error("Unexpected business date after India midnight");
});

Deno.test("previous working date skips Sunday", () => {
  if (previousWorkingDate("2026-10-12") !== "2026-10-10") throw new Error("Monday should compare against Saturday per the report definition");
});

Deno.test("PDF output has a valid header, xref offset, and trailer", () => {
  const bytes = makePdf(["VIBE report", "Leadership message: help (soon) \\ safely"]);
  const pdf = new TextDecoder().decode(bytes);
  if (!pdf.startsWith("%PDF-1.4\n") || !pdf.endsWith("%%EOF")) throw new Error("PDF header or trailer is missing");
  const start = Number(pdf.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  if (!Number.isFinite(start) || pdf.slice(start, start + 4) !== "xref") throw new Error("Cross-reference offset is invalid");
  if (!pdf.includes("Leadership message: help \\(soon\\) \\\\ safely")) throw new Error("PDF text escaping failed");
});
