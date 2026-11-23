export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // prevent formula injection when opened in Excel / Sheets
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens Thai text as UTF-8
  return "﻿" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}
