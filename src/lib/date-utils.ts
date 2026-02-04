/**
 * Shared Date Utilities (Frontend)
 * Standardizes Timezone handling across the React Application.
 * Default Timezone: Asia/Dubai (UTC+4)
 *
 * WHY:
 * New Date() uses the browser's local time. If the CEO travels or the team is distributed,
 * "Today" might mean "Yesterday" or "Tomorrow".
 * This forces all "Today" queries to align with the Business HQ (Dubai).
 */

export const BUSINESS_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * Returns the current date shifted to Business Time (Dubai).
 * Use this instead of `new Date()` for any business logic.
 */
export function getBusinessDate(): Date {
  const now = new Date();
  // Get UTC time by removing local offset
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  // Add Dubai Offset
  return new Date(utc + BUSINESS_OFFSET_MS);
}

/**
 * Returns "Today's" date string (YYYY-MM-DD) in Business Time.
 * Use this for database filters like `gte("created_at", getBusinessTodayString())`
 */
export function getBusinessTodayString(): string {
  return getBusinessDate().toISOString().split("T")[0];
}

/**
 * Returns the ISO string for the Start of the Month in Business Time.
 */
export function getBusinessStartOfMonth(): string {
  const date = getBusinessDate();
  // Set to 1st of month, 00:00:00
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  return start.toISOString();
}

/**
 * Returns the ISO string for N days ago in Business Time.
 */
export function getBusinessDateAgoISO(daysBack: number): string {
  const date = getBusinessDate();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString();
}
