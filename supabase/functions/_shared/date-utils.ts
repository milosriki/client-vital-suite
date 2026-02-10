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
 * Checks if current Dubai time is within business hours (7 AM - 10 PM).
 */
export function isDubaiWorkHours(): boolean {
  const dubaiDate = getDubaiDate();
  const hours = dubaiDate.getUTCHours(); // getDubaiDate adds 4 hours, so getUTCHours is already local
  return hours >= 7 && hours < 22;
}
