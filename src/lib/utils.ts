import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe toFixed — never crashes on undefined/null/NaN */
export function safeFixed(value: unknown, digits = 1): string {
  const n = Number(value);
  return isNaN(n) ? "0" : n.toFixed(digits);
}

/** Safe Date parser — returns null instead of Invalid Date */
export function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

/** Safe number — returns fallback instead of NaN */
export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Safe number formatting with locale string */
export function safeNum(value: unknown): string {
  const n = Number(value);
  return isNaN(n) ? "0" : n.toLocaleString();
}

/** Format AED currency */
export function formatAED(value: unknown): string {
  const n = Number(value);
  if (isNaN(n) || n === 0) return "—";
  return `AED ${n.toLocaleString()}`;
}

/** Format percentage */
export function formatPct(value: unknown, digits = 1): string {
  const n = Number(value);
  if (isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
