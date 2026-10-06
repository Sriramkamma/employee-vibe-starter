/**
 * Centralized business date helpers for VIBE.
 *
 * The authoritative business timezone for the platform is Asia/Kolkata.
 * All calendar dates ("today", "yesterday", check-in dates, date filters)
 * are calculated and represented in this timezone as "YYYY-MM-DD" strings.
 */

export const BUSINESS_TIMEZONE = "Asia/Kolkata";

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Returns the current calendar date in Asia/Kolkata as "YYYY-MM-DD".
 * Example: "2026-10-06"
 */
export function getBusinessDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }

  // Fallback to en-CA format
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Shifts a calendar date string (YYYY-MM-DD) by an integer number of days.
 * Pure calendar arithmetic using UTC dates to prevent local timezone / DST drift.
 * Example: shiftBusinessDate("2026-10-06", -1) => "2026-10-05"
 */
export function shiftBusinessDate(dateStr: string, dayDelta: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + dayDelta));
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utcDate.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/**
 * Returns the calendar date N days before today in Asia/Kolkata.
 * Example: getBusinessDateDaysAgo(6)
 */
export function getBusinessDateDaysAgo(days: number): string {
  return shiftBusinessDate(getBusinessDate(), -days);
}

/**
 * Formats a calendar date (YYYY-MM-DD) or ISO string for table / UI display
 * as "DD MMM YYYY" (e.g. "06 Oct 2026").
 *
 * For date-only strings, this parses calendar parts directly without any UTC
 * conversions that could shift the calendar date.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";

  // Date-only format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    const mIndex = parseInt(month, 10) - 1;
    const monthName = MONTH_NAMES_SHORT[mIndex] ?? month;
    return `${day} ${monthName} ${year}`;
  }

  // Full ISO timestamp (e.g. created_at, date_detected)
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a date string as "MMMM D, YYYY" (e.g. "October 6, 2026").
 * For dashboard overview headers and human-friendly labels.
 */
export function formatHumanDate(dateStr: string): string {
  if (!dateStr) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    const mIndex = parseInt(month, 10) - 1;
    const monthName = MONTH_NAMES_LONG[mIndex] ?? month;
    const dayNum = parseInt(day, 10);
    return `${monthName} ${dayNum}, ${year}`;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Formats the business date for employee welcome headers in Asia/Kolkata:
 * e.g. "Tuesday, October 6"
 */
export function formatBusinessDateHeader(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Formats a date string for chart axis labels (e.g. "Oct 6").
 */
export function formatChartDate(dateStr: string): string {
  if (!dateStr) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [, month, day] = dateStr.split("-");
    const mIndex = parseInt(month, 10) - 1;
    const monthName = MONTH_NAMES_SHORT[mIndex] ?? month;
    return `${monthName} ${parseInt(day, 10)}`;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(date);
}
