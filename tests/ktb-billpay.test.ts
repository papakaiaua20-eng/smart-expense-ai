import { expect, test } from "vitest";
import { parseSlip } from "@/lib/slip/parser";

// Real Tesseract output of a Krungthai "จ่ายบิลสำเร็จ" slip (names masked by the bank)
const TEXT = `ค      *
๒๕4       เส Krungthai
ต ( กรุงไทย
เ”   จ่ายบิลสําเร็จ
รหัสอ้างฮิง 20261122453598068
๑๐   น.ส.พัชรวถี แ“**
กรุงไทย
ุ      XXX-X-XX287-1
wv
123 เซอร์วิส
เน    (24228)
รหัสชําระเงิน                                  7728793758
รหัสอ้างอิง 2                                                  7728793758
รหัสลูกค้า                               TikTok Shop Seller
จํานวนเงิน                                     150.00 บาท
ค่าธรรมเนียม                                       0.00 บาท
วันที่ทํารายการ                         22 พ.ย. 2569 - 14:54
บันทึกช่วยจํา                                         บับเบิ้ล`;

test("Krungthai bill payment slip", () => {
  const p = parseSlip(TEXT, { today: "2026-11-23", ownAccountNames: [] });
  expect(p.amount.value).toBe(150);
  expect(p.fee).toBe(0);
  expect(p.date.value).toBe("2026-11-22");
  expect(p.time.value).toBe("14:54");
  expect(p.reference.value).toBe("20261122453598068");
  expect(p.senderName.value).toMatch(/^น\.ส\.พัชรวถี/);
  expect(p.receiverName.value).toBe("123 เซอร์วิส");
  expect(p.bank.value).toBe("กรุงไทย");
  expect(p.kind.value).toBe("payment");
  expect(p.suggestedType.value).toBe("expense");
});
