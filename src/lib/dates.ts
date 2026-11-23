// All "business dates" are in Asia/Bangkok. Dates are handled as YYYY-MM-DD strings.

export const TZ = "Asia/Bangkok";

export type RangePreset = "today" | "7d" | "this_month" | "last_month" | "this_year" | "custom";

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "วันนี้",
  "7d": "7 วันล่าสุด",
  this_month: "เดือนนี้",
  last_month: "เดือนก่อน",
  this_year: "ปีนี้",
  custom: "เลือกช่วงวันที่เอง",
};

export function todayISO(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  return toISO(y, m, d + n);
}

export function startOfMonth(iso: string): string {
  const { y, m } = parts(iso);
  return toISO(y, m, 1);
}

export function endOfMonth(iso: string): string {
  const { y, m } = parts(iso);
  return toISO(y, m + 1, 0);
}

export function addMonths(iso: string, n: number): string {
  const { y, m } = parts(iso);
  return toISO(y, m + n, 1);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parts(s);
  return toISO(y, m, d) === s;
}

export function resolveRange(
  preset: RangePreset,
  custom?: { from?: string | null; to?: string | null },
  now = new Date(),
): { from: string; to: string } {
  const today = todayISO(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "this_month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "last_month": {
      const s = addMonths(today, -1);
      return { from: s, to: endOfMonth(s) };
    }
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "custom": {
      const from = isValidISODate(custom?.from) ? custom!.from! : startOfMonth(today);
      const to = isValidISODate(custom?.to) ? custom!.to! : today;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** Previous period of equal length, immediately before `from`. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  // whole calendar months -> previous calendar months of the same count
  if (from === startOfMonth(from) && to === endOfMonth(to)) {
    const months =
      (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
      (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) +
      1;
    const pFrom = addMonths(from, -months);
    return { from: pFrom, to: addDays(from, -1) };
  }
  const len = daysBetween(from, to);
  return { from: addDays(from, -len - 1), to: addDays(from, -1) };
}

export type Granularity = "day" | "week" | "month" | "year";

/** Monday-based week start. */
export function startOfWeek(iso: string): string {
  const { y, m, d } = parts(iso);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return addDays(iso, -((dow + 6) % 7));
}

export function bucketKey(iso: string, g: Granularity): string {
  switch (g) {
    case "day":
      return iso;
    case "week":
      return startOfWeek(iso);
    case "month":
      return iso.slice(0, 7);
    case "year":
      return iso.slice(0, 4);
  }
}

/** All bucket keys covering [from, to], in order. */
export function bucketKeys(from: string, to: string, g: Granularity): string[] {
  const keys: string[] = [];
  let cur = g === "week" ? startOfWeek(from) : from;
  let guard = 0;
  while (cur <= to && guard++ < 1000) {
    const k = bucketKey(cur, g);
    if (keys[keys.length - 1] !== k) keys.push(k);
    if (g === "day") cur = addDays(cur, 1);
    else if (g === "week") cur = addDays(cur, 7);
    else if (g === "month") cur = addMonths(cur, 1);
    else cur = `${Number(cur.slice(0, 4)) + 1}-01-01`;
  }
  return keys;
}

export function autoGranularity(from: string, to: string): Granularity {
  const days = daysBetween(from, to);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  if (days <= 366 * 3) return "month";
  return "year";
}

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function bucketLabel(key: string, g: Granularity): string {
  if (g === "year") return String(Number(key) + 543);
  if (g === "month") {
    const m = Number(key.slice(5, 7));
    return `${TH_MONTHS_SHORT[m - 1]} ${String((Number(key.slice(0, 4)) + 543) % 100).padStart(2, "0")}`;
  }
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  return `${d} ${TH_MONTHS_SHORT[m - 1]}`;
}
