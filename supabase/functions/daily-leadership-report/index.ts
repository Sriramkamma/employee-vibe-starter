import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vibe-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const TZ = "Asia/Kolkata";
export const dateInIndia = (date = new Date()) => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""; return `${get("year")}-${get("month")}-${get("day")}`; };
const esc = (value: unknown) => String(value ?? "").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
const mood = ["", "Very low", "Low", "Neutral", "Good", "Happy"];
const workload = ["", "Light", "Manageable", "Demanding", "Intense", "Overwhelming"];
export function previousWorkingDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  do { value.setUTCDate(value.getUTCDate() - 1); } while (value.getUTCDay() === 0);
  return value.toISOString().slice(0, 10);
}

export function makePdf(input: string[]): Uint8Array {
  const lines = input.flatMap((line) => {
    const words = line.split(/\s+/); const wrapped: string[] = []; let current = "";
    for (const word of words) { if ((current + " " + word).trim().length > 92) { wrapped.push(current); current = word; } else current = (current + " " + word).trim(); }
    if (current) wrapped.push(current); return wrapped;
  });
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  if (!pages.length) pages.push(["No report data available."]);
  const objects: string[] = []; const pageIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>", "");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2; const streamId = pageId + 1; pageIds.push(pageId);
    const commands = ["BT", "/F1 10 Tf", "48 790 Td", ...page.flatMap((line, lineIndex) => [`(${esc(line)}) Tj`, lineIndex === page.length - 1 ? "" : "0 -15 Td"]), "ET"].filter(Boolean).join("\n");
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId - 1] = `<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`;
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
const base64 = (bytes: Uint8Array) => { let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); };

if (import.meta.main) Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const cronSecret = Deno.env.get("REPORT_CRON_SECRET");
  if (!cronSecret || req.headers.get("x-vibe-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REPORT_FROM_EMAIL");
  if (!resendKey || !from) return json({ error: "Email service is not configured" }, 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const reportDate = dateInIndia();
  const { data: settings, error: settingsError } = await db.from("daily_report_settings").select("organization_id");
  if (settingsError) return json({ error: "Unable to load report settings" }, 500);
  const { data: recipients, error: recipientError } = await db.from("daily_report_recipients").select("organization_id,email").order("organization_id");
  if (recipientError) return json({ error: "Unable to load configured recipients" }, 500);
  const organizations = (settings ?? []).map((row) => row.organization_id);
  const results: Array<{ organizationId: string; status: string }> = [];
  for (const organizationId of organizations) {
    const emails = (recipients ?? []).filter((row) => row.organization_id === organizationId).map((row) => row.email);
    if (!emails.length) {
      const { error } = await db.from("daily_report_deliveries").insert({ organization_id: organizationId, report_date: reportDate, recipients: [], status: "no_recipients" });
      results.push({ organizationId, status: error?.code === "23505" ? "already_processed" : error ? "claim_failed" : "no_recipients" });
      continue;
    }
    const { error: claimError } = await db.from("daily_report_deliveries").insert({ organization_id: organizationId, report_date: reportDate, recipients: emails, status: "sending" });
    let attemptCount = 1;
    if (claimError) {
      if (claimError.code !== "23505") { results.push({ organizationId, status: "claim_failed" }); continue; }
      const { data: retry, error: retryError } = await db.from("daily_report_deliveries").update({ status: "sending", recipients: emails, error_summary: null, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("report_date", reportDate).eq("status", "failed").select("attempt_count").maybeSingle();
      if (retryError || !retry) { results.push({ organizationId, status: "already_processed" }); continue; }
      attemptCount = retry.attempt_count + 1;
      await db.from("daily_report_deliveries").update({ attempt_count: attemptCount }).eq("organization_id", organizationId).eq("report_date", reportDate);
    }
    try {
      const { data: profiles, error: profileError } = await db.from("profiles").select("id,full_name,first_name,last_name,department_id,team_id").eq("organization_id", organizationId).eq("role", "employee").eq("is_active", true);
      if (profileError) throw new Error("Could not load eligible employee profiles");
      const ids = (profiles ?? []).map((p) => p.id); const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      let checkins: Array<Record<string, any>> = [];
      for (let start = 0; start < ids.length; start += 500) {
        const { data, error } = await db.from("check_ins").select("id,user_id,checkin_date,mood,energy,workload,requested_support,sentiment_score,answers").in("user_id", ids.slice(start, start + 500)).gte("checkin_date", new Date(new Date(`${reportDate}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10)).lte("checkin_date", reportDate);
        if (error) throw new Error("Could not load check-ins"); checkins.push(...(data ?? []));
      }
      const { data: signalRows, error: signalsError } = await db.from("signals").select("*").eq("organization_id", organizationId).eq("type", "leadership_request").lte("date_detected", `${reportDate}T23:59:59+05:30`).gte("date_detected", `${reportDate}T00:00:00+05:30`);
      if (signalsError) throw new Error("Could not load leadership signal statuses");
      const daily = new Map(checkins.filter((row) => row.checkin_date === reportDate).map((row) => [row.user_id, row]));
      const scores = [...daily.values()].flatMap((r) => Number.isFinite(r.sentiment_score) && r.sentiment_score >= 0 && r.sentiment_score <= 100 ? [r.sentiment_score] : []);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const previousDate = previousWorkingDate(reportDate);
      const previousScores = [...daily.entries()].flatMap(([userId, current]) => {
        const prior = checkins.find((row) => row.user_id === userId && row.checkin_date === previousDate);
        return prior && Number.isFinite(current.energy) === Number.isFinite(prior.energy) && Number.isFinite(prior.sentiment_score) && prior.sentiment_score >= 0 && prior.sentiment_score <= 100 ? [prior.sentiment_score] : [];
      });
      const previousAverage = previousScores.length ? Math.round(previousScores.reduce((a, b) => a + b, 0) / previousScores.length) : null;
      const change = avg !== null && previousAverage !== null ? avg - previousAverage : null;
      const missing = (profiles ?? []).length - daily.size;
      const activeSignals = (signalRows ?? []).filter((s) => !["resolved", "dismissed", "noted"].includes(s.status));
      const supportRequests = [...daily.values()].filter((row) => row.requested_support).length;
      const lines = [`VIBE Daily Employee Pulse Report — ${reportDate} (Asia/Kolkata)`, `Eligible employees: ${(profiles ?? []).length}`, `Completed: ${daily.size}; missing: ${missing}; participation: ${(profiles ?? []).length ? Math.round(daily.size / (profiles ?? []).length * 100) : 0}%`, `Average sentiment: ${avg === null ? "Unavailable (no valid scores)" : `${avg}/100`} (${scores.length} valid scores)`, `Change vs ${previousDate}: ${change === null ? "Unavailable" : `${change > 0 ? "+" : ""}${change}`} (matched Energy-answer format only)`, `Employees requesting support: ${supportRequests}`, `Outstanding leadership signals: ${activeSignals.length}`, "", "Employee details:"];
      for (const p of profiles ?? []) {
        const row = daily.get(p.id); const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee";
        if (!row) { lines.push(`${name}: Missing check-in; no answers or score recorded.`); continue; }
        const answer = row.answers ?? {}; const msg = row.requested_support ? answer.leadership_message : null;
        const associated = (signalRows ?? []).filter((s) => (s.employee_id ?? s.target_id) === p.id);
        const history = checkins.filter((item) => item.user_id === p.id && item.checkin_date >= new Date(new Date(`${reportDate}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10) && item.checkin_date <= reportDate && Number.isFinite(item.sentiment_score) && item.sentiment_score >= 0 && item.sentiment_score <= 100 && Number.isFinite(item.energy) === Number.isFinite(row.energy));
        const sevenDayAverage = history.length ? Math.round(history.reduce((sum, item) => sum + item.sentiment_score, 0) / history.length) : null;
        lines.push(`${name}: sentiment ${Number.isFinite(row.sentiment_score) && row.sentiment_score >= 0 && row.sentiment_score <= 100 ? row.sentiment_score : "Unavailable"}; mood ${mood[row.mood] ?? "Unavailable"}; workload ${workload[row.workload] ?? "Unavailable"}; seven-calendar-day average ${sevenDayAverage ?? "Unavailable"}; support ${row.requested_support ? "requested" : "not requested"}; signal status ${associated.map((s) => s.status).join(", ") || "none"}.`);
        if (typeof msg === "string" && msg.trim()) lines.push(`Leadership message: ${msg.trim()}`);
      }
      const pdf = makePdf(lines);
      const summary = `VIBE daily report for ${reportDate}: ${(profiles ?? []).length} eligible, ${daily.size} completed, ${missing} missing. Average sentiment: ${avg === null ? "unavailable" : `${avg}/100`}. Outstanding leadership signals: ${activeSignals.length}. See the attached PDF for details.`;
      const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: emails, subject: `VIBE daily leadership report — ${reportDate}`, text: summary, attachments: [{ filename: `vibe-report-${reportDate}.pdf`, content: base64(pdf) }] }) });
      if (!emailResponse.ok) throw new Error(`Resend rejected delivery (HTTP ${emailResponse.status})`);
      await db.from("daily_report_deliveries").update({ status: "sent", updated_at: new Date().toISOString(), error_summary: null }).eq("organization_id", organizationId).eq("report_date", reportDate);
      results.push({ organizationId, status: "sent" });
    } catch (error) {
      const summary = error instanceof Error ? error.message.slice(0, 240) : "Unexpected report error";
      await db.from("daily_report_deliveries").update({ status: "failed", attempt_count: attemptCount, error_summary: summary, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("report_date", reportDate);
      results.push({ organizationId, status: "failed" });
    }
  }
  return json({ date: reportDate, organizations: results });
});
