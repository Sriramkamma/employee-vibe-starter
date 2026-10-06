import { supabase } from "../../lib/supabase";
import { calculateSentiment } from "../admin/utils/sentimentEngine";
import type { Signal, TrendDataPoint } from "../admin/adminTypes";

export type CheckInRecord = {
  id: string;
  date: string;
  submittedAt: string;
  userId: string;
  userName: string;
  mood: number;
  energy: number;
  workload: number;
  requestedSupport: boolean;
  sentimentScore: number;
  answers?: Record<string, unknown> | null;
  leadershipMessage?: string | null;
};

export type CheckInInput = Omit<
  CheckInRecord,
  "id" | "date" | "submittedAt" | "sentimentScore"
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

/**
 * Fetch all check-ins visible to the current Supabase user.
 *
 * RLS decides what the user is allowed to see:
 * - Employees → their own check-ins
 * - Admins → organization check-ins
 */
export async function getCheckIns(): Promise<CheckInRecord[]> {
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
    .order("checkin_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch check-ins:", error);
    throw new Error("Unable to load check-ins.");
  }

  if (!data || data.length === 0) {
    return [];
  }

  /*
   * Fetch profile names separately.
   * This avoids depending on a specific Supabase relationship name.
   */
  const userIds = [...new Set(data.map((record) => record.user_id))];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name")
    .in("id", userIds);

  if (profilesError) {
    console.error("Failed to fetch profile names:", profilesError);
  }

  const profileMap = new Map<
    string,
    {
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }
  >();

  for (const profile of profiles ?? []) {
    profileMap.set(profile.id, profile);
  }

  return data.map((record) => {
    const profile = profileMap.get(record.user_id);

    const userName =
      profile?.full_name ||
      [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ") ||
      "Employee";

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
    .upsert(
      {
        user_id: user.id,
        checkin_date: today,
        mood: input.mood,
        energy: input.energy,
        workload: input.workload,
        requested_support: input.requestedSupport,
        answers: answersPayload,
      },
      {
        onConflict: "user_id,checkin_date",
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

      energy: average(
        (record) => ((record.energy - 1) / 4) * 100,
      ),

      workload: average(
        (record) => ((record.workload - 1) / 4) * 100,
      ),

      responseRate: 0,
    });
  }

  return data.filter((point) =>
    records.some((record) => record.date === point.date),
  );
}

/**
 * Get the previous working dates.
 *
 * VIBE currently uses Monday-Saturday as working days.
 * Sunday is excluded.
 */
function getPreviousWorkingDates(
  dateString: string,
  count: number,
): string[] {
  const result: string[] = [];
  const date = new Date(`${dateString}T12:00:00`);

  while (result.length < count) {
    date.setDate(date.getDate() - 1);

    const day = date.getDay();

    // Sunday = 0
    // Monday-Saturday = working days
    if (day !== 0) {
      result.push(
        [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-"),
      );
    }
  }

  return result;
}

/**
 * Checks whether an employee has low sentiment on
 * four consecutive working days.
 *
 * Low sentiment threshold = 60.
 */
function hasFourConsecutiveLowDays(
  userRecords: CheckInRecord[],
): boolean {
  if (userRecords.length < 4) {
    return false;
  }

  const recordsByDate = new Map(
    userRecords.map((record) => [
      record.date,
      record,
    ]),
  );

  const latestDate =
    userRecords[userRecords.length - 1].date;

  const requiredDates = [
    latestDate,
    ...getPreviousWorkingDates(latestDate, 3),
  ];

  for (const date of requiredDates) {
    const record = recordsByDate.get(date);

    if (!record) {
      return false;
    }

    if (record.sentimentScore >= 60) {
      return false;
    }
  }

  return true;
}

/**
 * Builds admin signals from check-in data.
 *
 * Current signals:
 * - Leadership follow-up request
 * - High work pressure
 * - Four consecutive working days of low sentiment
 */
export function buildSignals(
  records: CheckInRecord[],
): Signal[] {
  const recordsByUser = new Map<
    string,
    CheckInRecord[]
  >();

  for (const record of records) {
    const existing =
      recordsByUser.get(record.userId) ?? [];

    existing.push(record);

    recordsByUser.set(record.userId, existing);
  }

  const signals: Signal[] = [];

  for (const userRecords of recordsByUser.values()) {
    userRecords.sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const latest =
      userRecords[userRecords.length - 1];

    if (!latest) continue;

    const target = {
      targetId: latest.userId,
      targetName: latest.userName || "Employee",
    };

    /*
     * Leadership support request.
     */
    if (latest.requestedSupport) {
      signals.push({
        id: `support-${latest.id}`,
        type: "leadership_followup",
        severity: "high",
        dateDetected: latest.submittedAt,
        affectedScope: "employee",
        ...target,
        evidence:
          "This employee asked for a leadership follow-up.",
        status: "new",
        recommendedAction:
          "Reach out privately and offer support.",
      });
    }

    /*
     * High work pressure.
     */
    if (latest.workload >= 4) {
      signals.push({
        id: `pressure-${latest.id}`,
        type: "high_workload",
        severity:
          latest.workload === 5 ? "high" : "medium",
        dateDetected: latest.submittedAt,
        affectedScope: "employee",
        ...target,
        evidence:
          latest.workload === 5
            ? "Work pressure was rated Overwhelming."
            : "Work pressure was rated Intense.",
        status: "new",
        recommendedAction:
          "Check in about current workload and priorities.",
      });
    }

    /*
     * Core VIBE requirement:
     * four consecutive working days with sentiment below 60.
     */
    if (hasFourConsecutiveLowDays(userRecords)) {
      signals.push({
        id: `sustained-${latest.userId}-${latest.date}`,
        type: "low_sentiment",
        severity: "high",
        dateDetected: latest.submittedAt,
        affectedScope: "employee",
        ...target,
        evidence:
          "Sentiment remained below 60 for four consecutive working days.",
        status: "new",
        recommendedAction:
          "Arrange a confidential check-in and understand what support would help.",
      });
    }
  }

  return signals.sort((a, b) =>
    b.dateDetected.localeCompare(a.dateDetected),
  );
}