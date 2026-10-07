import { supabase } from "../../lib/supabase";
import { getBusinessDate } from "../../utils/dateUtils";

// ─── Label maps ──────────────────────────────────────────────────────────────
// These match the exact labels used in CheckInPage.tsx so the admin view
// shows the same human-readable text the employee saw.

export const MOOD_LABELS: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Neutral",
  4: "Good",
  5: "Happy",
};

export const ENERGY_LABELS: Record<number, string> = {
  1: "Exhausted",
  2: "Tired",
  3: "Steady",
  4: "Fresh",
  5: "Energised",
};

export const WORKLOAD_LABELS: Record<number, string> = {
  1: "Light",
  2: "Manageable",
  3: "Demanding",
  4: "Intense",
  5: "Overwhelming",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmployeeCheckInRow = {
  /** check_in row id */
  checkInId: string;
  /** profile id (user id) */
  userId: string;
  fullName: string;
  email: string | null;
  /** YYYY-MM-DD */
  checkInDate: string;
  submittedAt?: string;
  mood: number;
  energy: number;
  workload: number;
  requestedSupport: boolean;
  /** Server-calculated score – NOT recalculated on the frontend */
  sentimentScore: number | null;
  answers?: Record<string, unknown> | null;
  leadershipMessage?: string | null;
};

export type EmployeeSummary = {
  totalEmployees: number;
  totalCheckIns: number;
  averageSentiment: number;
  leadershipRequests: number;
};

export type FetchEmployeeCheckInsOptions = {
  organizationId: string;
  employeeId?: string | null;
  fromDate?: string | null; // YYYY-MM-DD
  toDate?: string | null;   // YYYY-MM-DD
  page?: number;            // 0-indexed
  pageSize?: number;
};

export type FetchEmployeeCheckInsResult = {
  rows: EmployeeCheckInRow[];
  totalCount: number;
};

export type EmployeeOption = { id: string; fullName: string; email: string | null };
export type LeadershipSignalRef = { id: string; employeeId: string; date: string; checkInId: string | null; status: string };
type RawEmployeeCheckIn = {
  id: string;
  user_id: string;
  checkin_date: string;
  created_at: string;
  mood: number;
  energy: number;
  workload: number;
  requested_support: boolean;
  sentiment_score: number | null;
  answers?: Record<string, unknown> | null;
};

export async function fetchEmployeeOptions(organizationId: string): Promise<EmployeeOption[]> {
  const data = await loadEmployeeProfiles(organizationId);
  return data.map((p) => ({
    id: p.id,
    fullName: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee",
    email: p.email ?? null,
  }));
}

export async function fetchLeadershipSignalRefs(organizationId: string, fromDate: string, toDate: string): Promise<LeadershipSignalRef[]> {
  const rows: Array<Record<string, any>> = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("signals").select("*").eq("type", "leadership_request")
      .gte("date_detected", `${fromDate}T00:00:00+05:30`).lte("date_detected", `${toDate}T23:59:59.999+05:30`)
      .order("date_detected", { ascending: false }).range(offset, offset + 999);
    if (organizationId) query = query.eq("organization_id", organizationId);
    const { data, error } = await query;
    if (error) throw new Error("Unable to load leadership request status.");
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows.flatMap((row) => {
    const employeeId = row.employee_id ?? row.target_id;
    const detected = row.date_detected ?? row.created_at;
    if (!row.id || !employeeId || !detected) return [];
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    return [{ id: row.id, employeeId, date: getBusinessDate(new Date(detected)), checkInId: row.check_in_id ?? row.checkin_id ?? row.source_checkin_id ?? row.source_check_in_id ?? row.check_in_ref ?? metadata.check_in_id ?? metadata.checkin_id ?? metadata.source_checkin_id ?? metadata.source_check_in_id ?? null, status: row.status }];
  });
}

async function loadEmployeeProfiles(organizationId: string) {
  const rows: Array<{ id: string; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("profiles").select("id,full_name,first_name,last_name,email").eq("role", "employee").eq("organization_id", organizationId).order("full_name").range(offset, offset + 999);
    if (error) throw new Error("Unable to load employee profiles.");
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function fetchIndividualCheckIns(userId: string, fromDate: string, toDate: string): Promise<EmployeeCheckInRow[]> {
  const data: Array<{ id: string; user_id: string; checkin_date: string; mood: number; energy: number; workload: number; requested_support: boolean; sentiment_score: number | null; answers: Record<string, unknown> | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: batch, error } = await supabase.from("check_ins")
      .select("id, user_id, checkin_date, mood, energy, workload, requested_support, sentiment_score, answers")
      .eq("user_id", userId).gte("checkin_date", fromDate).lte("checkin_date", toDate)
      .order("checkin_date", { ascending: true }).order("created_at", { ascending: true }).range(offset, offset + 999);
    if (error) throw new Error("Unable to load this employee's check-ins.");
    data.push(...(batch ?? []));
    if ((batch ?? []).length < 1000) break;
  }
  return data.map((r) => {
    const rawAnswers = (r as { answers?: Record<string, unknown> | null }).answers ?? null;
    const msg = (rawAnswers?.leadership_message as string | undefined) ?? null;
    return {
      checkInId: r.id,
      userId: r.user_id,
      fullName: "",
      email: null,
      checkInDate: r.checkin_date,
      submittedAt: "",
      mood: r.mood,
      energy: r.energy,
      workload: r.workload,
      requestedSupport: r.requested_support,
      sentimentScore: r.sentiment_score,
      answers: rawAnswers,
      leadershipMessage: msg,
    };
  });
}

// ─── Fetch paginated employee check-ins ──────────────────────────────────────

/**
 * Fetches check-in records for employees only (role = 'employee').
 *
 * Security: Supabase RLS ensures admins can only read data they are
 * authorised to see. This query additionally filters by role='employee'
 * so admin accounts never appear in the table.
 *
 * Uses the existing supabase client (no service-role key).
 */
export async function fetchEmployeeCheckIns(
  options: FetchEmployeeCheckInsOptions,
): Promise<FetchEmployeeCheckInsResult> {
  const {
    fromDate,
    toDate,
    organizationId,
    employeeId,
    page = 0,
    pageSize = 25,
  } = options;


  // 1. First, get all employee profile IDs (role = 'employee').
  //    We pull email here as well since auth.users is not directly
  //    accessible from the public schema via the anon key.
  let profiles;
  try { profiles = await loadEmployeeProfiles(organizationId); }
  catch (error) { console.error("Failed to fetch employee profiles:", error); throw error; }

  if (!profiles || profiles.length === 0) {
    return { rows: [], totalCount: 0 };
  }

  const employeeIds = employeeId ? profiles.filter((p) => p.id === employeeId).map((p) => p.id) : profiles.map((p) => p.id);
  if (!employeeIds.length) return { rows: [], totalCount: 0 };

  // Build a lookup map: userId -> profile metadata
  const profileMap = new Map<
    string,
    { fullName: string; email: string | null }
  >();

  for (const p of profiles) {
    const fullName =
      p.full_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      "Employee";
    profileMap.set(p.id, { fullName, email: p.email ?? null });
  }

  // 2. Build the check_ins query with date filters.
  let query = supabase
    .from("check_ins")
    .select(
      `
        id,
        user_id,
        checkin_date,
        created_at,
        mood,
        energy,
        workload,
        requested_support,
        sentiment_score,
        answers
      `,
      { count: "exact" },
    )
    .in("user_id", employeeIds)
    .order("checkin_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (fromDate) {
    query = query.gte("checkin_date", fromDate);
  }
  if (toDate) {
    query = query.lte("checkin_date", toDate);
  }

  const checkIns: RawEmployeeCheckIn[] = [];
  let totalCount = 0;
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error, count } = await query.range(offset, offset + batchSize - 1);
    if (error) {
      console.error("Failed to fetch check-ins:", error);
      throw new Error("Unable to load check-in records.");
    }
    if (offset === 0) totalCount = count ?? 0;
    const batch = data ?? [];
    checkIns.push(...batch);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  const rows: EmployeeCheckInRow[] = (checkIns ?? []).map((row) => {
    const profile = profileMap.get(row.user_id);
    const rawAnswers = (row as { answers?: Record<string, unknown> | null }).answers ?? null;
    const msg = (rawAnswers?.leadership_message as string | undefined) ?? null;

    return {
      checkInId: row.id,
      userId: row.user_id,
      fullName: profile?.fullName ?? "Employee",
      email: profile?.email ?? null,
      checkInDate: row.checkin_date,
      submittedAt: row.created_at,
      mood: row.mood,
      energy: row.energy,
      workload: row.workload,
      requestedSupport: row.requested_support,
      sentimentScore: row.sentiment_score,
      answers: rawAnswers,
      leadershipMessage: msg,
    };
  });

  rows.sort((a, b) => {
    const aLow = a.sentimentScore !== null && a.sentimentScore < 40;
    const bLow = b.sentimentScore !== null && b.sentimentScore < 40;
    if (aLow !== bLow) return aLow ? -1 : 1;
    return b.checkInDate.localeCompare(a.checkInDate) || (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");
  });
  const start = page * pageSize;
  return { rows: rows.slice(start, start + pageSize), totalCount: totalCount || rows.length };
}

// ─── Fetch summary statistics ─────────────────────────────────────────────────

/**
 * Returns aggregate statistics for the Employees page header KPI cards.
 * Respects the same date filters as the main table query.
 */
export async function fetchEmployeeSummary(
  options: { organizationId: string; employeeId?: string | null; fromDate?: string | null; toDate?: string | null },
): Promise<EmployeeSummary> {
  const { fromDate, toDate, organizationId, employeeId } = options;

  // Employee IDs
  const profiles = await loadEmployeeProfiles(organizationId);

  if (!profiles || profiles.length === 0) {
    return {
      totalEmployees: profiles?.length ?? 0,
      totalCheckIns: 0,
      averageSentiment: 0,
      leadershipRequests: 0,
    };
  }

  const employeeIds = employeeId ? profiles.filter((p) => p.id === employeeId).map((p) => p.id) : profiles.map((p) => p.id);
  if (!employeeIds.length) return { totalEmployees: profiles.length, totalCheckIns: 0, averageSentiment: 0, leadershipRequests: 0 };
  const totalEmployees = profiles.length;

  let query = supabase
    .from("check_ins")
    .select("sentiment_score, requested_support")
    .in("user_id", employeeIds);

  if (fromDate) query = query.gte("checkin_date", fromDate);
  if (toDate)   query = query.lte("checkin_date", toDate);

  const checkIns: Array<{ sentiment_score: number | null; requested_support: boolean }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: checkInsError } = await query.range(offset, offset + 999);
    if (checkInsError) { console.error("Failed to fetch employee summary check-ins:", checkInsError); throw new Error("Unable to load employee summary."); }
    const batch = data ?? [];
    checkIns.push(...batch);
    if (batch.length < 1000) break;
  }

  const totalCheckIns = checkIns.length;
  const leadershipRequests = checkIns.filter((c) => c.requested_support).length;

  const scoredRows = checkIns.filter(
    (c) => c.sentiment_score !== null && c.sentiment_score !== undefined,
  );
  const averageSentiment =
    scoredRows.length > 0
      ? Math.round(
          scoredRows.reduce(
            (sum, c) => sum + (c.sentiment_score as number),
            0,
          ) / scoredRows.length,
        )
      : 0;

  return {
    totalEmployees,
    totalCheckIns,
    averageSentiment,
    leadershipRequests,
  };
}
