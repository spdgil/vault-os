/**
 * Date utilities shared across temporal views.
 */

/** Today's date as YYYY-MM-DD. */
export function todayString(): string {
  return formatDate(new Date());
}

/** Format a Date as YYYY-MM-DD. */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format a Date for display: "Sunday, 13 April 2026". */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Parse a YYYY-MM-DD string into a Date. Returns null if invalid. */
export function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** True if dueDate (YYYY-MM-DD) is strictly before today. */
export function isOverdue(dueDate: string, today: string): boolean {
  return dueDate < today;
}

/** True if dueDate (YYYY-MM-DD) matches target exactly. */
export function isDueOn(dueDate: string, target: string): boolean {
  return dueDate === target;
}

/** Add (or subtract) days from a YYYY-MM-DD string. Returns YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Convert a display name to a URL-safe slug: "Kingdom of God" → "kingdom-of-god". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
