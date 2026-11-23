import { describe, expect, it } from "vitest";
import { parseSlip, normalizeYear, nameMatches } from "@/lib/slip/parser";
import { parseSlipQr } from "@/lib/slip/qr";

const TODAY = "2026-11-20";

const KBANK = `โอนเงินสำเร็จ
20 พ.ย. 69 14:32 น.
นาย สมชาย ใ
ธ.กสิกรไทย
xxx-x-x1234-x
นางสาว สมหญิง ร
ธ.ไทยพาณิชย์
xxx-x-x5678-x
เลขที่รายการ:
016324143259BOR04861
จำนวน:
1,250.00 บาท
ค่าธรรมเนียม:
0.00 บาท`;

const SCB = `ไทยพาณิชย์ SCB
โอนเงินสำเร็จ
20 Nov 2026 - 09:15
รหัสอ้างอิง: 202611200915ABC1234
จาก นาย สมชาย ใจดี
xxx-xxx123-4
ไปยัง ร้าน กาแฟดี
จำนวนเงิน 85.00`;

// Tesseract tends to split Thai words with spaces and mis-encode สระอำ
const NOISY = `โอน เงิน สํา เร็จ
จาก นาย สม ชาย ใจ ดี
ไป ยัง บจก. ร้าน อาหาร อร่อย
วัน ที่ 03/11/2569 เวลา 19:05
จํา นวน เงิน 2 450.50 บาท
เลข ที่ อ้าง อิง 2025 1103 7788 99`;

const PAYMENT = `Krungthai
ชำระเงินสำเร็จ
ผู้รับเงิน 7-ELEVEN
05 ต.ค. 2569 08:01
฿ 64.00
Ref No. 1234567890XYZ`;

describe("parseSlip", () => {
  it("parses a KBank-style transfer slip", () => {
    const r = parseSlip(KBANK, { today: TODAY, ownAccountNames: ["สมชาย ใจดี"] });
    expect(r.amount.value).toBe(1250);
    expect(r.amount.status).toBe("ok");
    expect(r.fee).toBe(0);
    expect(r.date.value).toBe("2026-11-20");
    expect(r.time.value).toBe("14:32");
    expect(r.reference.value).toBe("016324143259BOR04861");
    expect(r.bank.value).toBe("กสิกรไทย");
    expect(r.senderName.value).toContain("สมชาย");
    expect(r.receiverName.value).toContain("สมหญิง");
    expect(r.kind.value).toBe("transfer");
    expect(r.suggestedType.value).toBe("expense");
  });

  it("parses an SCB-style slip with labels and English date", () => {
    const r = parseSlip(SCB, { today: TODAY });
    expect(r.amount.value).toBe(85);
    expect(r.date.value).toBe("2026-11-20");
    expect(r.time.value).toBe("09:15");
    expect(r.reference.value).toBe("202611200915ABC1234");
    expect(r.senderName.value).toBe("นาย สมชาย ใจดี");
    expect(r.receiverName.value).toBe("ร้าน กาแฟดี");
    expect(r.bank.value).toBe("ไทยพาณิชย์");
  });

  it("does not guess income/expense without the user's own names", () => {
    const r = parseSlip(SCB, { today: TODAY });
    expect(r.suggestedType.value).toBeNull();
    expect(r.suggestedType.status).toBe("missing");
    expect(r.needsReview).toBe(true);
  });

  it("detects income when the receiver is the user", () => {
    const r = parseSlip(KBANK, { today: TODAY, ownAccountNames: ["สมหญิง รักดี"] });
    expect(r.suggestedType.value).toBe("income");
  });

  it("detects transfer between own accounts", () => {
    const r = parseSlip(KBANK, { today: TODAY, ownAccountNames: ["สมหญิง รักดี", "สมชาย ใจดี"] });
    expect(r.suggestedType.value).toBe("transfer");
  });

  it("handles noisy Thai OCR output", () => {
    const r = parseSlip(NOISY, { today: TODAY });
    expect(r.amount.value).toBe(2450.5);
    expect(r.date.value).toBe("2026-11-03");
    expect(r.time.value).toBe("19:05");
    expect(r.reference.value).toBe("20251103778899");
    expect(r.senderName.value).toContain("สม");
  });

  it("parses a payment slip with ฿ and Ref No.", () => {
    const r = parseSlip(PAYMENT, { today: TODAY });
    expect(r.amount.value).toBe(64);
    expect(r.amount.status).toBe("ok");
    expect(r.date.value).toBe("2026-10-05");
    expect(r.reference.value).toBe("1234567890XYZ");
    expect(r.bank.value).toBe("กรุงไทย");
    expect(r.kind.value).toBe("payment");
    expect(r.receiverName.value).toBe("7-ELEVEN");
    expect(r.suggestedType.value).toBe("expense");
    expect(r.suggestedType.status).toBe("review");
  });

  it("never invents values from empty text", () => {
    const r = parseSlip("", { today: TODAY });
    expect(r.amount.value).toBeNull();
    expect(r.date.value).toBeNull();
    expect(r.reference.value).toBeNull();
    expect(r.senderName.value).toBeNull();
    expect(r.overallConfidence).toBe(0);
    expect(r.needsReview).toBe(true);
    expect(r.warnings).toContain("อ่านจำนวนเงินไม่ได้ กรุณากรอกเอง");
  });

  it("flags a future date for review", () => {
    const r = parseSlip("จำนวนเงิน 100.00 บาท\n15/01/2570", { today: TODAY });
    expect(r.date.value).toBe("2027-01-15");
    expect(r.date.status).toBe("review");
  });

  it("uses the QR reference and bank when available", () => {
    const ref = "016324143259BOR04861";
    const inner = `0006000001` + `0103004` + `02${String(ref.length).padStart(2, "0")}${ref}`;
    const qr = `00${String(inner.length).padStart(2, "0")}${inner}5102TH91041234`;
    const r = parseSlip("จำนวน 50.00 บาท", { today: TODAY, qrPayload: qr });
    expect(r.reference.value).toBe(ref);
    expect(r.reference.source).toBe("qr");
    expect(r.bank.value).toBe("กสิกรไทย");
  });

  it("ignores balance lines when finding the amount", () => {
    const r = parseSlip("ยอดเงินคงเหลือ 25,000.00 บาท\nจำนวนเงิน 300.00 บาท", { today: TODAY });
    expect(r.amount.value).toBe(300);
  });
});

describe("helpers", () => {
  it("normalizes years", () => {
    expect(normalizeYear(2569)).toBe(2026);
    expect(normalizeYear(69)).toBe(2026);
    expect(normalizeYear(26)).toBe(2026);
    expect(normalizeYear(2026)).toBe(2026);
  });
  it("matches truncated names", () => {
    expect(nameMatches("นาย สมชาย ใ", ["สมชาย ใจดี"])).toBe(true);
    expect(nameMatches("MR. SOMCHAI J", ["Somchai Jaidee"])).toBe(true);
    expect(nameMatches("นาย มานะ ดี", ["สมชาย ใจดี"])).toBe(false);
  });
  it("rejects non-slip QR payloads", () => {
    expect(parseSlipQr("https://example.com")).toBeNull();
    expect(parseSlipQr("000201010211")).toBeNull();
  });
});
