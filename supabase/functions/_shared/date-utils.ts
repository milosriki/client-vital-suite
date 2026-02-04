/**
 * Shared Date Utilities
 * Standardizes Timezone handling across all Edge Functions.
 * Default Timezone: Asia/Dubai (UTC+4)
 */

export const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * Returns the current date in Dubai Timezone.
 */
export function getDubaiDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + DUBAI_OFFSET_MS);
}

/**
 * Returns "Today's" date string (YYYY-MM-DD) in Dubai Time.
 * Use this for database queries filtering for "Created Today".
 */
export function getDubaiTodayString(): string {
  return getDubaiDate().toISOString().split("T")[0];
}

/**
 * Returns an ISO string for N days ago, relative to Dubai time.
 * @param daysBack Number of days to look back
 */
export function getDubaiDateAgoISO(daysBack: number): string {
  const date = getDubaiDate();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString();
}
