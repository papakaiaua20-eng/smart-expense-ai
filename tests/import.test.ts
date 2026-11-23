import { describe, expect, it } from "vitest";
import { prepareImport, targetCategory, importKey } from "@/lib/import/office-ledger";

const e = (o: Record<string, unknown>) => ({ id: "x1", date: "2026-11-09", type: "expense", amount: 5000, category: "ค่าใช้จ่ายอื่นๆ", description: "ชำระเงินค่าครีม", vendor: "บริษัท ABC", method: "โอน / พร้อมเพย์", bank: "กรุงเทพ (BBL)", tags: ["ลูกค้าA"], note: "ref 123", ...o });

describe("office-ledger import", () => {
  it("maps fields", () => {
    const { rows } = prepareImport([e({})]);
    expect(rows[0]).toMatchObject({
      import_key: "office-ledger:x1", type: "expense", amount: 5000, transaction_date: "2026-11-09",
      categoryName: "อื่น ๆ", merchant_name: "บริษัท ABC", payment_method: "โอน / พร้อมเพย์", bank: "กรุงเทพ (BBL)",
    });
    expect(rows[0].note).toBe("ชำระเงินค่าครีม · ref 123 · #ลูกค้าA");
  });
  it("maps equivalent categories and keeps office-specific ones", () => {
    expect(targetCategory({ category: "อาหาร / เครื่องดื่ม", type: "expense" })).toBe("อาหาร/รับรองลูกค้า");
    expect(targetCategory({ category: "ค่าเดินทาง / ขนส่ง", type: "expense" })).toBe("ค่าเดินทาง/น้ำมัน");
    expect(targetCategory({ category: "สั่งของ / วัสดุสำนักงาน", type: "expense" })).toBe("อุปกรณ์สำนักงาน/เครื่องเขียน");
    expect(targetCategory({ category: "ค่าการตลาดพิเศษ", type: "expense" })).toBe("ค่าการตลาดพิเศษ");
  });
  it("skips examples, bad rows and duplicates inside the file", () => {
    const r = prepareImport([e({}), e({}), e({ id: "x2", example: true }), e({ id: "x3", amount: 0 }), e({ id: "x4", date: "2026-13-01" }), "junk"]);
    expect(r.rows).toHaveLength(1);
    expect(r.skipped.reduce((a, s) => a + s.count, 0)).toBe(5);
  });
  it("lists categories to create", () => {
    const r = prepareImport([e({ category: "ค่าการตลาดพิเศษ" }), e({ id: "y", type: "income", category: "รายรับจากการขาย / บริการ" })]);
    expect(r.categoryNames).toEqual([
      { name: "ค่าการตลาดพิเศษ", type: "expense" },
      { name: "รายรับจากการขาย / บริการ", type: "income" },
    ]);
  });
  it("fingerprints entries without id stably", () => {
    const a = e({ id: undefined });
    expect(importKey(a as never)).toBe(importKey({ ...a } as never));
    expect(importKey(a as never)).toMatch(/^office-ledger:fp-/);
  });
});
