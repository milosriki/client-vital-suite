/**
 * Call duration utility.
 *
 * call_records.duration_seconds actually stores MILLISECONDS (not seconds).
 * HubSpot returns hs_call_duration in ms; our sync writes it directly.
 * This module normalises the raw value and formats it for display.
 */

/** Convert the raw DB value (ms or occasionally seconds) to seconds. */
export function durationToSeconds(raw: number | null | undefined): number {
  if (!raw) return 0;
  // Values > 1000 are almost certainly milliseconds
  // (a real 1000-second call = 16 min is plausible, but 99%+ of our data is ms)
  return raw > 1000 ? Math.round(raw / 1000) : raw;
}

/** Pretty-print seconds as "Xm Ys" or "Xh Ym". */
export function formatCallDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

/** One-shot: raw DB value → display string. */
export function displayDuration(raw: number | null | undefined): string {
  return formatCallDuration(durationToSeconds(raw));
}
