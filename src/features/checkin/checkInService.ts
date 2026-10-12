import { supabase } from "../../lib/supabase";
import type { TrendDataPoint } from "../admin/adminTypes";

export type CheckInRecord = {
  id: string;
  date: string;
  submittedAt: string;
  userId: string;
  userName: string;
  mood: number;
  energy: number | null;
  workload: number;
  requestedSupport: boolean;
  sentimentScore: number;
  answers?: Record<string, unknown> | null;
  leadershipMessage?: string | null;
};

export type CheckInInput = Omit<
  CheckInRecord,
  "id" | "date" | "submittedAt" | "sentimentScore" | "energy"
> & {
  answers?: Record<string, unknown> | null;
  leadershipMessage?: string | null;
};

import { getBusinessDate, shiftBusinessDate } from "../../utils/dateUtils";

/**
 * Fetch an employee's check-in for a specific business date from Supabase.
 * Defaults to today's Asia/Kolkata business date.
 */
export async function getCheckInForDate(
  userId: string,
  date: string = getBusinessDate(),
): Promise<CheckInRecord | null> {
  const { data, error } = await supabase
    .from("check_ins")
    .select(`
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
    `)
    .eq("user_id", userId)
    .eq("checkin_date", date)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch check-in for date:", error);
    throw new Error("Unable to verify daily check-in status.");
  }

  if (!data) {
    return null;
  }

  const rawAnswers = (data as { answers?: Record<string, unknown> | null }).answers ?? null;
  const leadershipMsg = (rawAnswers?.leadership_message as string | undefined) ?? null;

  return {
    id: data.id,
    date: data.checkin_date,
    submittedAt: data.created_at,
    userId: data.user_id,
    userName: "",
    mood: data.mood,
    energy: data.energy,
    workload: data.workload,
    requestedSupport: data.requested_support,
    sentimentScore: data.sentiment_score,
    answers: rawAnswers,
    leadershipMessage: leadershipMsg,
  };
}

/**
 * Check whether the current user has already completed a check-in for today's
 * Asia/Kolkata calendar date. Source of truth is the Supabase check_ins table.
 */
export async function getTodayCheckIn(
  userId: string,
): Promise<CheckInRecord | null> {
  return getCheckInForDate(userId, getBusinessDate());
}

export async function getRecentCheckInsForUser(userId: string, fromDate: string, toDate: string): Promise<CheckInRecord[]> {
  const { data, error } = await supabase.from("check_ins").select("id,user_id,checkin_date,created_at,mood,energy,workload,requested_support,sentiment_score,answers").eq("user_id", userId).gte("checkin_date", fromDate).lte("checkin_date", toDate).order("checkin_date", { ascending: true });
  if (error) throw new Error("Unable to load check-in history.");
  return (data ?? []).map((record) => ({ id: record.id, date: record.checkin_date, submittedAt: record.created_at, userId: record.user_id, userName: "", mood: record.mood, energy: record.energy, workload: record.workload, requestedSupport: record.requested_support, sentimentScore: record.sentiment_score, answers: record.answers }));
}

/**
 * Fetch all check-ins visible to the current Supabase user.
 *
 * RLS decides what the user is allowed to see:
 * - Employees → their own check-ins
 * - Admins → organization check-ins
 */
export async function getCheckIns(fromDate?: string, toDate?: string, organizationId?: string): Promise<CheckInRecord[]> {
  if (!organizationId) throw new Error("Organization scope is required to load analytics.");
  const employeeProfiles: Array<{ id: string; full_name: string | null; first_name: string | null; last_name: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("profiles").select("id,full_name,first_name,last_name").eq("organization_id", organizationId).eq("role", "employee").range(offset, offset + 999);
    if (error) throw new Error("Unable to load organization employees for analytics.");
    employeeProfiles.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const names = new Map(employeeProfiles.map((p) => [p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee"]));
  const data: Array<{ id: string; user_id: string; checkin_date: string; created_at: string; mood: number; energy: number | null; workload: number; requested_support: boolean; sentiment_score: number; answers: Record<string, unknown> | null }> = [];
  const employeeIds = employeeProfiles.map((profile) => profile.id);
  for (let idOffset = 0; idOffset < employeeIds.length; idOffset += 500) {
    const batchIds = employeeIds.slice(idOffset, idOffset + 500);
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from("check_ins").select(`
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
      `).in("user_id", batchIds).order("checkin_date", { ascending: true });
      if (fromDate) query = query.gte("checkin_date", fromDate);
      if (toDate) query = query.lte("checkin_date", toDate);
      const { data: batchData, error } = await query.range(offset, offset + 999);
      if (error) { console.error("Failed to fetch check-ins:", error); throw new Error("Unable to load check-ins."); }
      const batch = batchData ?? [];
      data.push(...batch);
      if (batch.length < 1000) break;
    }
  }

  if (!data || data.length === 0) {
    return [];
  }

  const userIds = [...new Set(data.map((record) => record.user_id))];

  return data.map((record) => {
    const userName = names.get(record.user_id) ?? "Employee";

    const rawAnswers = (record as { answers?: Record<string, unknown> | null }).answers ?? null;
    const leadershipMsg = (rawAnswers?.leadership_message as string | undefined) ?? null;

    return {
      id: record.id,
      date: record.checkin_date,
      submittedAt: record.created_at,
      userId: record.user_id,
      userName,
      mood: record.mood,
      energy: record.energy,
      workload: record.workload,
      requestedSupport: record.requested_support,
      sentimentScore: record.sentiment_score,
      answers: rawAnswers,
      leadershipMessage: leadershipMsg,
    };
  });
}

/**
 * Save today's check-in.
 *
 * IMPORTANT:
 * The frontend sends only the answers.
 * Supabase calculates the authoritative sentiment_score.
 */
export async function saveCheckIn(
  input: CheckInInput,
): Promise<CheckInRecord> {
  const {
    data: {
      user,
    },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to submit a check-in.");
  }

  const today = getBusinessDate();

  const answersPayload =
    input.answers ??
    (input.requestedSupport
      ? {
          leadership_request: "Yes, please",
          leadership_message: input.leadershipMessage || null,
        }
      : {
          leadership_request: "Not right now",
        });

  const { data, error } = await supabase
    .from("check_ins")
    .insert(
      {
        user_id: user.id,
        checkin_date: today,
        mood: input.mood,
        workload: input.workload,
        requested_support: input.requestedSupport,
        answers: answersPayload,
      },
    )
    .select(`
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
    `)
    .single();

  if (error) {
    console.error("Failed to save check-in:", error);
    if (error.code === "23505") {
      throw new Error("Today's check-in has already been submitted.");
    }
    throw new Error(
      error.message || "Unable to save your check-in.",
    );
  }

  const rawAnswers = (data as { answers?: Record<string, unknown> | null }).answers ?? null;
  const leadershipMsg =
    (rawAnswers?.leadership_message as string | undefined) ??
    input.leadershipMessage ??
    null;

  return {
    id: data.id,
    date: data.checkin_date,
    submittedAt: data.created_at,
    userId: data.user_id,
    userName: input.userName || "Employee",
    mood: data.mood,
    energy: data.energy,
    workload: data.workload,
    requestedSupport: data.requested_support,
    sentimentScore: data.sentiment_score,
    answers: rawAnswers,
    leadershipMessage: leadershipMsg,
  };
}

/**
 * Compatibility helper.
 *
 * The old application used a browser event to refresh localStorage-based
 * admin data. Supabase does not need that event, but keeping this function
 * means existing imports won't immediately break.
 *
 * Returns a no-op unsubscribe function.
 */
export function subscribeToCheckIns(
  _onChange: () => void,
): () => void {
  return () => { };
}

/**
 * Build daily trend information from Supabase-backed records.
 */
export function buildTrendData(
  records: CheckInRecord[],
  days = 30,
): TrendDataPoint[] {
  const data: TrendDataPoint[] = [];
  const today = getBusinessDate();

  for (let offset = days - 1; offset >= 0; offset--) {
    const key = shiftBusinessDate(today, -offset);

    const dayRecords = records.filter(
      (record) => record.date === key,
    );

    const average = (
      get: (record: CheckInRecord) => number,
    ) =>
      dayRecords.length
        ? Math.round(
          dayRecords.reduce(
            (sum, record) => sum + get(record),
            0,
          ) / dayRecords.length,
        )
        : 0;

    data.push({
      date: key,

      /*
       * Use the server-calculated sentiment score.
       * This is now the authoritative value stored in Supabase.
       */
      sentiment: average(
        (record) => record.sentimentScore,
      ),

      mood: average(
        (record) => ((record.mood - 1) / 4) * 100,
      ),

      energy: (() => {
        const energyRecords = dayRecords.filter((record) => Number.isFinite(record.energy));
        return energyRecords.length ? Math.round(energyRecords.reduce((sum, record) => sum + ((((record.energy as number) - 1) / 4) * 100), 0) / energyRecords.length) : null;
      })(),

      workload: average(
        (record) => normalizeWorkloadForSentiment(record.workload),
      ),

      responseRate: null,
    });
  }

  return data.filter((point) =>
    records.some((record) => record.date === point.date),
  );
}
import { normalizeWorkloadForSentiment } from "../../utils/workload";
