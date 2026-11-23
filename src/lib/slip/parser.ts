// Parses OCR text of Thai bank transfer / payment slips into structured fields.
//
// Rules from the brief:
// - Never invent data: every value must come from the OCR text or the slip QR code.
// - Unclear values get status "review" (ต้องตรวจสอบ); absent values are null / "missing".
// - Income vs expense is NOT decided from bank or receiver name alone. We only suggest it when
//   a name on the slip matches one of the user's own account names (set in Settings).

import { bankByCode, detectBanks } from "./banks";
import { parseSlipQr } from "./qr";

export type FieldStatus = "ok" | "review" | "missing";
export type FieldSource = "ocr" | "qr" | "none";

export type Field<T> = {
  value: T | null;
  confidence: number; // 0..1
  status: FieldStatus;
  source: FieldSource;
};

export type SlipKind = "transfer" | "payment" | "topup" | "withdrawal" | "receive";

export type ParsedSlip = {
  amount: Field<number>;
  fee: number | null;
  date: Field<string>; // YYYY-MM-DD (Gregorian)
  time: Field<string>; // HH:MM
  senderName: Field<string>;
  receiverName: Field<string>;
  bank: Field<string>;
  reference: Field<string>;
  kind: Field<SlipKind>;
  suggestedType: Field<"income" | "expense" | "transfer"> & { reason: string };
  overallConfidence: number;
  needsReview: boolean;
  warnings: string[];
};

const missing = <T>(): Field<T> => ({ value: null, confidence: 0, status: "missing", source: "none" });
const field = <T>(value: T, confidence: number, source: FieldSource = "ocr"): Field<T> => ({
  value,
  confidence: Math.round(confidence * 100) / 100,
  status: confidence >= 0.7 ? "ok" : "review",
  source,
});

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function normalizeText(raw: string): string {
  return raw
    .replace(/[​-‍﻿­]/g, "")
    .replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
    .replace(/ํา/g, "ำ") // นิคหิต+สระอา -> สระอำ (common OCR output)
    .replace(/[\t ]+/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Remove spaces between Thai characters (Tesseract often splits Thai words). Used for label matching only. */
function squash(line: string): string {
  return line.replace(/([฀-๿])\s+(?=[฀-๿])/g, "$1");
}

// ---------------------------------------------------------------------------
// Amount
// ---------------------------------------------------------------------------
const MONEY_RE = /(?<![\d.,])(\d{1,3}(?:[,\s]\d{3})+|\d{1,9})[.,](\d{2})(?![\d])/g;

function moneyIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(MONEY_RE)) {
    const v = Number(m[1].replace(/[,\s]/g, "") + "." + m[2]);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

const AMOUNT_LABEL = /(จำนวนเงิน|จำนวน|ยอดเงิน|ยอดชำระ|ยอดโอน|ยอดรวม|amount|total)/i;
const FEE_LABEL = /(ค่าธรรมเนียม|fee)/i;
const NOT_AMOUNT = /(คงเหลือ|ยอดเงินคงเหลือ|balance|available|วงเงิน)/i;

function parseAmount(lines: string[], sq: string[]): { amount: Field<number>; fee: number | null } {
  let fee: number | null = null;
  let labeled: number | null = null;
  const bahtAdjacent: number[] = [];
  const all: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const s = sq[i];
    const values = moneyIn(line);
    if (FEE_LABEL.test(s)) {
      const v = values[0] ?? moneyIn(lines[i + 1] ?? "")[0];
      if (v !== undefined) fee = v;
      continue;
    }
    if (NOT_AMOUNT.test(s)) continue;
    if (labeled === null && AMOUNT_LABEL.test(s)) {
      const v = values[0] ?? (FEE_LABEL.test(sq[i + 1] ?? "") ? undefined : moneyIn(lines[i + 1] ?? "")[0]);
      if (v !== undefined && v > 0) labeled = v;
    }
    for (const m of line.matchAll(MONEY_RE)) {
      const v = Number(m[1].replace(/[,\s]/g, "") + "." + m[2]);
      if (!(v > 0)) continue;
      all.push(v);
      const before = line.slice(Math.max(0, (m.index ?? 0) - 3), m.index);
      const after = squash(line.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 6));
      if (/฿|thb/i.test(before) || /^\s*(บาท|thb|฿)/i.test(after)) bahtAdjacent.push(v);
    }
  }

  if (labeled !== null) return { amount: field(labeled, 0.92), fee };
  if (bahtAdjacent.length) return { amount: field(Math.max(...bahtAdjacent), 0.75), fee };
  if (all.length) return { amount: field(Math.max(...all), 0.4), fee };
  return { amount: missing(), fee };
}

// ---------------------------------------------------------------------------
// Date & time
// ---------------------------------------------------------------------------
const TH_MONTHS: [string[], number][] = [
  [["มกราคม", "ม.ค."], 1],
  [["กุมภาพันธ์", "ก.พ."], 2],
  [["มีนาคม", "มี.ค."], 3],
  [["เมษายน", "เม.ย."], 4],
  [["พฤษภาคม", "พ.ค."], 5],
  [["มิถุนายน", "มิ.ย."], 6],
  [["กรกฎาคม", "ก.ค."], 7],
  [["สิงหาคม", "ส.ค."], 8],
  [["กันยายน", "ก.ย."], 9],
  [["ตุลาคม", "ต.ค."], 10],
  [["พฤศจิกายน", "พ.ย."], 11],
  [["ธันวาคม", "ธ.ค."], 12],
];
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "พ.ย." -> allow "พ.ย", "พ. ย.", "พย"
function abbrevPattern(abbr: string) {
  return abbr
    .replace(/\./g, "")
    .split("")
    .map((c) => escapeRe(c))
    .join("\\.?\\s?") + "\\.?";
}

const TH_MONTH_RE = new RegExp(
  "(\\d{1,2})\\s*(" +
    TH_MONTHS.flatMap(([names]) => [escapeRe(names[0]), abbrevPattern(names[1])]).join("|") +
    ")\\s*(\\d{4}|\\d{2})(?!\\d)",
);
const EN_MONTH_RE = /(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?[\s-]*(\d{4}|\d{2})(?!\d)/i;
const NUM_DATE_RE = /(?<!\d)(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)/;
const ISO_DATE_RE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/;

export function normalizeYear(y: number): number {
  if (y >= 2400) return y - 543; // Buddhist Era
  if (y >= 1900) return y;
  if (y >= 40 && y < 100) return 1957 + y; // 2-digit BE, e.g. 69 -> 2569 -> 2026
  if (y >= 0 && y < 40) return 2000 + y; // 2-digit CE
  return y;
}

function monthFromThai(token: string): number | null {
  const t = token.replace(/[.\s]/g, "");
  for (const [names, m] of TH_MONTHS) {
    if (names[0] === t || names[1].replace(/\./g, "") === t) return m;
  }
  return null;
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

function parseDate(lines: string[], sq: string[], today: string): { date: Field<string>; line: number } {
  for (let i = 0; i < lines.length; i++) {
    const candidates: { iso: string | null; conf: number }[] = [];
    let m = TH_MONTH_RE.exec(sq[i]);
    if (m) {
      const mon = monthFromThai(m[2]);
      if (mon) candidates.push({ iso: validDate(normalizeYear(Number(m[3])), mon, Number(m[1])), conf: 0.9 });
    }
    m = EN_MONTH_RE.exec(lines[i]);
    if (m) {
      const mon = EN_MONTHS.indexOf(m[2].toLowerCase()) + 1;
      candidates.push({ iso: validDate(normalizeYear(Number(m[3])), mon, Number(m[1])), conf: 0.88 });
    }
    m = ISO_DATE_RE.exec(lines[i]);
    if (m) candidates.push({ iso: validDate(normalizeYear(Number(m[1])), Number(m[2]), Number(m[3])), conf: 0.85 });
    m = NUM_DATE_RE.exec(lines[i]);
    if (m) candidates.push({ iso: validDate(normalizeYear(Number(m[3])), Number(m[2]), Number(m[1])), conf: 0.75 });

    for (const c of candidates) {
      if (!c.iso) continue;
      // A slip date in the future (beyond tomorrow) or very old is suspicious.
      const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
      const tenYearsAgo = `${Number(today.slice(0, 4)) - 10}${today.slice(4)}`;
      const conf = c.iso > tomorrow || c.iso < tenYearsAgo ? 0.3 : c.conf;
      return { date: field(c.iso, conf), line: i };
    }
  }
  return { date: missing(), line: -1 };
}

const TIME_RE = /(?<![\d:.])([01]?\d|2[0-3])\s?:\s?([0-5]\d)(?::([0-5]\d))?(?![\d])/;
const TIME_DOT_RE = /(?<![\d:.])([01]?\d|2[0-3])\.([0-5]\d)\s*น/;

function parseTime(lines: string[], dateLine: number): Field<string> {
  const order = dateLine >= 0 ? [dateLine, dateLine + 1, dateLine - 1, ...lines.keys()] : [...lines.keys()];
  for (const i of order) {
    const line = lines[i];
    if (!line) continue;
    const m = TIME_RE.exec(line) ?? TIME_DOT_RE.exec(line);
    if (m) {
      const hhmm = `${m[1].padStart(2, "0")}:${m[2]}`;
      return field(hhmm, i === dateLine || i === dateLine + 1 ? 0.85 : 0.65);
    }
  }
  return missing();
}

// ---------------------------------------------------------------------------
// Reference number
// ---------------------------------------------------------------------------
const REF_LABEL =
  /(เลขที่รายการ|รหัสอ้างอิง|เลขอ้างอิง|หมายเลขอ้างอิง|เลขที่อ้างอิง|รหัสรายการ|รหัสธุรกรรม|หมายเลขรายการ|ref(?:erence)?\.?\s*(?:no|id|code)?\.?|transaction\s*(?:id|no\.?|ref)|trans(?:action)?\.?\s*id)/i;

function parseReference(lines: string[], sq: string[]): Field<string> {
  for (let i = 0; i < lines.length; i++) {
    const m = REF_LABEL.exec(sq[i]);
    if (!m) continue;
    const rest = sq[i].slice((m.index ?? 0) + m[0].length);
    const pick = (s: string) => {
      const compact = s.replace(/[:：#]/g, " ").trim();
      // tokens may be split by OCR spaces: join runs of alnum groups
      const joined = compact.replace(/([A-Za-z0-9])\s+(?=[A-Za-z0-9])/g, "$1");
      const tok = /[A-Za-z0-9]{8,40}/.exec(joined);
      return tok && /\d/.test(tok[0]) ? tok[0] : null;
    };
    const v = pick(rest) ?? pick(sq[i + 1] ?? "");
    if (v) return field(v, 0.85);
  }
  return missing();
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------
const SENDER_LABEL = /^(โอนจาก|จาก|ผู้โอน|from(?![a-z])|sender(?![a-z]))[:：]?\s*/i;
const RECEIVER_LABEL = /^(ไปยัง|ไปที่|ถึง|ผู้รับ(?:เงิน)?|โอนไป(?:ยัง)?|ชำระให้|ร้านค้า|to(?![a-z])|receiver(?![a-z])|merchant(?![a-z])|biller(?![a-z]))[:：]?\s*/i;
const PERSON_PREFIX =
  /^(นาย|นางสาว|นาง|น\.?\s?ส\.?|ด\.?\s?ช\.?|ด\.?\s?ญ\.?|บจก\.?|บมจ\.?|บริษัท|หจก\.?|ห้างหุ้นส่วน|ร้าน|mr\.?|mrs\.?|ms\.?|miss)\s*/i;
const ACCOUNT_LINE = /(?:x{2,}|\*{2,}|\d{3}-\d-\d{5}-\d|(?:\d[\s-]?){8,})/i;
const NOT_NAME =
  /(สำเร็จ|successful|ธนาคาร|bank|จำนวน|amount|ค่าธรรมเนียม|fee|เลขที่|รหัส|ref|วันที่|date|บาท|พร้อมเพย์|promptpay|scan|สแกน|qr|ตรวจสอบ|บันทึกช่วยจำ|memo|note)/i;

function cleanName(s: string): string | null {
  const v = s
    .replace(ACCOUNT_LINE, "")
    .replace(/[|•·]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (v.length < 2 || v.length > 120) return null;
  if (!/[A-Za-z฀-๿]{2,}/.test(v)) return null;
  return v;
}

function parseNames(lines: string[], sq: string[]): { sender: Field<string>; receiver: Field<string> } {
  let sender: Field<string> = missing();
  let receiver: Field<string> = missing();

  const valueAfter = (i: number, re: RegExp): string | null => {
    const rest = lines[i].replace(re, "").trim();
    const restSq = squash(rest);
    if (rest && !re.test(restSq) && !NOT_NAME.test(restSq)) {
      const c = cleanName(rest);
      if (c) return c;
    }
    for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
      if (NOT_NAME.test(sq[j]) || ACCOUNT_LINE.test(lines[j]) && !PERSON_PREFIX.test(lines[j])) continue;
      const c = cleanName(lines[j]);
      if (c) return c;
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    if (sender.value === null && SENDER_LABEL.test(sq[i])) {
      const v = valueAfter(i, SENDER_LABEL);
      if (v) sender = field(v, 0.8);
    } else if (receiver.value === null && RECEIVER_LABEL.test(sq[i])) {
      const v = valueAfter(i, RECEIVER_LABEL);
      if (v) receiver = field(v, 0.8);
    }
  }

  if (sender.value === null || receiver.value === null) {
    // Positional fallback: first name-like line = sender, second = receiver (typical slip layout).
    const people: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!PERSON_PREFIX.test(lines[i]) || NOT_NAME.test(sq[i])) continue;
      const c = cleanName(lines[i]);
      if (c && c !== sender.value && c !== receiver.value) people.push(c);
    }
    if (sender.value === null && receiver.value === null) {
      if (people[0]) sender = field(people[0], 0.55);
      if (people[1]) receiver = field(people[1], 0.55);
    } else if (sender.value === null && people[0]) {
      sender = field(people[0], 0.5);
    } else if (receiver.value === null && people[0]) {
      receiver = field(people[0], 0.5);
    }
  }
  return { sender, receiver };
}

// ---------------------------------------------------------------------------
// Kind
// ---------------------------------------------------------------------------
function parseKind(text: string): Field<SlipKind> {
  const s = squash(text);
  if (/(ถอนเงิน|withdraw)/i.test(s)) return field<SlipKind>("withdrawal", 0.8);
  if (/(เติมเงิน|top\s?-?up)/i.test(s)) return field<SlipKind>("topup", 0.8);
  if (/(ชำระเงินสำเร็จ|ชำระบิล|จ่ายบิล|ชำระสินค้า|bill\s*payment|payment\s*success|paid)/i.test(s))
    return field<SlipKind>("payment", 0.8);
  if (/(รับเงินสำเร็จ|ได้รับเงิน|money\s*received)/i.test(s)) return field<SlipKind>("receive", 0.75);
  if (/(โอนเงินสำเร็จ|โอนเงิน|transfer)/i.test(s)) return field<SlipKind>("transfer", 0.8);
  return missing();
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(PERSON_PREFIX, "")
    .replace(/[^a-z฀-๿]/g, "");
}

export function nameMatches(slipName: string | null, own: string[]): boolean {
  if (!slipName) return false;
  const a = normName(slipName);
  if (a.length < 3) return false;
  return own.some((o) => {
    const parts = o.split(/\s+/).map(normName).filter((p) => p.length >= 3);
    const full = normName(o);
    if (full.length >= 3 && (a.includes(full) || full.includes(a))) return true;
    // first name match (slips often truncate the surname)
    return parts.length > 0 && a.startsWith(parts[0]);
  });
}

function suggestType(
  sender: string | null,
  receiver: string | null,
  kind: SlipKind | null,
  ownNames: string[],
): ParsedSlip["suggestedType"] {
  const s = nameMatches(sender, ownNames);
  const r = nameMatches(receiver, ownNames);
  if (s && r) return { ...field("transfer" as const, 0.85), reason: "ชื่อผู้โอนและผู้รับตรงกับชื่อบัญชีของคุณ (โอนระหว่างบัญชี)" };
  if (s) return { ...field("expense" as const, 0.85), reason: "ชื่อผู้โอนตรงกับชื่อบัญชีของคุณ" };
  if (r) return { ...field("income" as const, 0.85), reason: "ชื่อผู้รับตรงกับชื่อบัญชีของคุณ" };
  if (kind === "withdrawal") return { ...field("expense" as const, 0.5), reason: "สลิปถอนเงิน กรุณาตรวจสอบประเภท" };
  if (kind === "payment" || kind === "topup")
    return { ...field("expense" as const, 0.5), reason: "สลิปชำระเงิน/เติมเงิน มักเป็นรายจ่าย กรุณาตรวจสอบ" };
  if (kind === "receive") return { ...field("income" as const, 0.5), reason: "สลิปรับเงิน กรุณาตรวจสอบประเภท" };
  return {
    ...missing<"income" | "expense" | "transfer">(),
    reason:
      ownNames.length === 0
        ? "ยังไม่ได้ตั้งชื่อบัญชีของคุณในหน้าตั้งค่า ระบบจึงบอกไม่ได้ว่าเป็นรายรับหรือรายจ่าย"
        : "ชื่อบนสลิปไม่ตรงกับชื่อบัญชีของคุณ กรุณาเลือกประเภทเอง",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function parseSlip(
  rawText: string,
  opts: { qrPayload?: string | null; ownAccountNames?: string[]; today?: string } = {},
): ParsedSlip {
  const text = normalizeText(rawText ?? "");
  const lines = text.split("\n");
  const sq = lines.map(squash);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];

  const { amount, fee } = parseAmount(lines, sq);
  const { date, line: dateLine } = parseDate(lines, sq, today);
  const time = parseTime(lines, dateLine);
  let reference = parseReference(lines, sq);
  const { sender, receiver } = parseNames(lines, sq);
  const kind = parseKind(text);

  const banks = detectBanks(text);
  let bank: Field<string> = banks[0] ? field(banks[0].name, banks.length === 1 ? 0.8 : 0.7) : missing();

  const qr = parseSlipQr(opts.qrPayload);
  if (qr) {
    const qrBank = bankByCode(qr.sendingBankCode);
    if (qrBank) bank = field(qrBank.name, 0.98, "qr");
    if (reference.value && reference.value !== qr.transRef && !qr.transRef.includes(reference.value)) {
      warnings.push("เลขอ้างอิงที่อ่านจากข้อความไม่ตรงกับ QR บนสลิป ระบบใช้ค่าจาก QR");
    }
    reference = field(qr.transRef, 0.98, "qr");
  }

  if (amount.status === "missing") warnings.push("อ่านจำนวนเงินไม่ได้ กรุณากรอกเอง");
  else if (amount.status === "review") warnings.push("ไม่แน่ใจจำนวนเงิน กรุณาตรวจสอบ");
  if (date.status === "missing") warnings.push("อ่านวันที่ไม่ได้ กรุณากรอกเอง");
  else if (date.status === "review") warnings.push("วันที่บนสลิปดูผิดปกติ กรุณาตรวจสอบ");
  if (reference.status === "missing") warnings.push("ไม่พบเลขอ้างอิง ระบบจะตรวจรายการซ้ำจากยอดเงินและวันที่แทน");

  const suggestedType = suggestType(sender.value, receiver.value, kind.value, opts.ownAccountNames ?? []);

  const weights: [Field<unknown>, number][] = [
    [amount, 0.35],
    [date, 0.25],
    [reference, 0.15],
    [time, 0.05],
    [sender, 0.05],
    [receiver, 0.05],
    [bank, 0.1],
  ];
  const overallConfidence =
    Math.round(weights.reduce((acc, [f, w]) => acc + f.confidence * w, 0) * 1000) / 1000;

  const needsReview =
    amount.status !== "ok" || date.status !== "ok" || suggestedType.status !== "ok" || warnings.length > 0;

  return {
    amount,
    fee,
    date,
    time,
    senderName: sender,
    receiverName: receiver,
    bank,
    reference,
    kind,
    suggestedType,
    overallConfidence,
    needsReview,
    warnings,
  };
}
