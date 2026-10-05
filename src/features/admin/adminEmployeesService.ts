import { supabase } from "../../lib/supabase";

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
  mood: number;
  energy: number;
  workload: number;
  requestedSupport: boolean;
  /** Server-calculated score – NOT recalculated on the frontend */
  sentimentScore: number | null;
};

export type EmployeeSummary = {
  totalEmployees: number;
  totalCheckIns: number;
  averageSentiment: number;
  leadershipRequests: number;
};

export type FetchEmployeeCheckInsOptions = {
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

export async function fetchEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data, error } = await supabase.from("profiles")
    .select("id, full_name, first_name, last_name, email")
    .eq("role", "employee").order("full_name");
  if (error) throw new Error("Unable to load employee profiles.");
  return (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee",
    email: p.email ?? null,
  }));
}

export async function fetchIndividualCheckIns(userId: string, fromDate: string, toDate: string): Promise<EmployeeCheckInRow[]> {
  const { data, error } = await supabase.from("check_ins")
    .select("id, user_id, checkin_date, mood, energy, workload, requested_support, sentiment_score")
    .eq("user_id", userId).gte("checkin_date", fromDate).lte("checkin_date", toDate)
    .order("checkin_date", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load this employee's check-ins.");
  return (data ?? []).map((r) => ({
    checkInId: r.id, userId: r.user_id, fullName: "", email: null, checkInDate: r.checkin_date,
    mood: r.mood, energy: r.energy, workload: r.workload, requestedSupport: r.requested_support,
    sentimentScore: r.sentiment_score,
  }));
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
  options: FetchEmployeeCheckInsOptions = {},
): Promise<FetchEmployeeCheckInsResult> {
  const {
    fromDate,
    toDate,
    page = 0,
    pageSize = 25,
  } = options;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // 1. First, get all employee profile IDs (role = 'employee').
  //    We pull email here as well since auth.users is not directly
  //    accessible from the public schema via the anon key.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name, email, role")
    .eq("role", "employee");

  if (profilesError) {
    console.error("Failed to fetch employee profiles:", profilesError);
    throw new Error("Unable to load employee profiles.");
  }

  if (!profiles || profiles.length === 0) {
    return { rows: [], totalCount: 0 };
  }

  const employeeIds = profiles.map((p) => p.id);

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
        mood,
        energy,
        workload,
        requested_support,
        sentiment_score
      `,
      { count: "exact" },
    )
    .in("user_id", employeeIds)
    .order("checkin_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (fromDate) {
    query = query.gte("checkin_date", fromDate);
  }
  if (toDate) {
    query = query.lte("checkin_date", toDate);
  }

  const { data: checkIns, error: checkInsError, count } = await query;

  if (checkInsError) {
    console.error("Failed to fetch check-ins:", checkInsError);
    throw new Error("Unable to load check-in records.");
  }

  const rows: EmployeeCheckInRow[] = (checkIns ?? []).map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      checkInId: row.id,
      userId: row.user_id,
      fullName: profile?.fullName ?? "Employee",
      email: profile?.email ?? null,
      checkInDate: row.checkin_date,
      mood: row.mood,
      energy: row.energy,
      workload: row.workload,
      requestedSupport: row.requested_support,
      sentimentScore: row.sentiment_score,
    };
  });

  return { rows, totalCount: count ?? 0 };
}

// ─── Fetch summary statistics ─────────────────────────────────────────────────

/**
 * Returns aggregate statistics for the Employees page header KPI cards.
 * Respects the same date filters as the main table query.
 */
export async function fetchEmployeeSummary(
  options: { fromDate?: string | null; toDate?: string | null } = {},
): Promise<EmployeeSummary> {
  const { fromDate, toDate } = options;

  // Employee IDs
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "employee");

  if (profilesError) {
    console.error("Failed to fetch employee profiles for summary:", profilesError);
    throw new Error("Unable to load employee summary.");
  }

  if (!profiles || profiles.length === 0) {
    return {
      totalEmployees: profiles?.length ?? 0,
      totalCheckIns: 0,
      averageSentiment: 0,
      leadershipRequests: 0,
    };
  }

  const employeeIds = profiles.map((p) => p.id);
  const totalEmployees = employeeIds.length;

  let query = supabase
    .from("check_ins")
    .select("sentiment_score, requested_support")
    .in("user_id", employeeIds);

  if (fromDate) query = query.gte("checkin_date", fromDate);
  if (toDate)   query = query.lte("checkin_date", toDate);

  const { data: checkIns, error: checkInsError } = await query;

  if (checkInsError || !checkIns) {
    console.error("Failed to fetch employee summary check-ins:", checkInsError);
    throw new Error("Unable to load employee summary.");
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
