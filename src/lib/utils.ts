import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const thb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTHB(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return thb.format(Number.isFinite(v) ? v : 0);
}

export function formatNumber(n: number, digits = 0) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** "2026-11-20" -> "20 พ.ย. 2569" */
export function formatThaiDate(iso: string | null | undefined, opts?: { short?: boolean }) {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: opts?.short ? "2-digit" : "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/** Round to 2 decimals without float drift for display/aggregation of NUMERIC strings. */
export function toSatang(v: number | string): number {
  return Math.round(Number(v) * 100);
}
export function fromSatang(s: number): number {
  return s / 100;
}

/** Mask long account-like digit runs: 123-4-56789-0 -> xxx-x-x6789-0 style (keep last 4 digits). */
export function maskAccount(text: string | null | undefined) {
  if (!text) return text ?? null;
  return text.replace(/(?:\d[\s-]?){8,}/g, (m) => {
    const digits = m.replace(/\D/g, "");
    return "x".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  });
}
