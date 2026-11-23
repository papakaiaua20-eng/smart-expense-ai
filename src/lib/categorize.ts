// Suggests a category for a transaction from the merchant name.
// Priority: the user's own learned rules > built-in Thai merchant keywords > "อื่น ๆ".

import type { Category, CategoryType, MerchantRule } from "./types";

export type CategorySuggestion = {
  categoryId: string | null;
  categoryName: string | null;
  confidence: number; // 0..1
  reason: string;
};

export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(นาย|นางสาว|นาง|น\.?ส\.?|บจก\.?|บมจ\.?|บริษัท|หจก\.?|ร้าน|mr\.?|mrs\.?|ms\.?)\s*/i, "")
    .replace(/\s*(จำกัด|\(มหาชน\)|co\.?,?\s*ltd\.?|limited|plc\.?)\s*/gi, " ")
    .replace(/[^a-z0-9฀-๿]+/g, " ")
    .trim();
}

// keyword -> default category name (must match names seeded in migration 0004_office_categories)
// Order matters: the first match wins (e.g. ads before platform, grab food before grab).
const KEYWORDS: { re: RegExp; name: string; type: CategoryType }[] = [
  // ---- expense ----
  { re: /(โฆษณา|facebook|meta\s*(platforms|ads)?|fb\s*ads|google\s*ads|tiktok\s*ads|ads\s*manager|line\s*(oa|official)|บูสต์|boost|influencer|อินฟลู|รีวิว|การตลาด|marketing)/i, name: "ค่าโฆษณา/การตลาด", type: "expense" },
  { re: /(tiktok|shopee(?!\s*food)|lazada|line\s*shopping|ค่าธรรมเนียมการขาย|commission\s*fee|seller)/i, name: "ค่าธรรมเนียมแพลตฟอร์ม", type: "expense" },
  { re: /(flash\s*express|แฟลช|kerry|เคอรี่|kex|j\s*&\s*t|เจแอนด์ที|ไปรษณีย์|thailand\s*post|ems|best\s*express|ninja\s*van|dhl|fedex|scg\s*express|lalamove|ลาล่ามูฟ|grab\s*express|nim\s*express|นิ่มเอ็กซ์เพรส|ขนส่ง|ส่งของ|ค่าส่ง|shipping)/i, name: "ค่าขนส่ง/ค่าส่งของ", type: "expense" },
  { re: /(กล่อง|box|เทป|tape|บับเบิ้ล|บับเบิล|bubble|ซองไปรษณีย์|ซองพลาสติก|packaging|แพ็คเกจจิ้ง|บรรจุภัณฑ์|สติกเกอร์|sticker|ฉลาก)/i, name: "บรรจุภัณฑ์", type: "expense" },
  { re: /(เงินเดือน|ค่าจ้าง|ค่าแรง|ค่าคอม|คอมมิชชั่น|คอมมิชชัน|commission|salary|payroll|โบนัส|bonus|พนักงาน|ฟรีแลนซ์|freelance)/i, name: "เงินเดือน/ค่าจ้าง/คอมมิชชัน", type: "expense" },
  { re: /(ค่าเช่า|โกดัง|warehouse|สำนักงาน|office\s*rent|นิติบุคคล|ค่าส่วนกลาง|คอนโด|อพาร์ทเม้นท์)/i, name: "ค่าเช่าสำนักงาน/โกดัง", type: "expense" },
  { re: /(การไฟฟ้า|ไฟฟ้า|pea|mea|การประปา|ประปา|pwa|mwa|ค่าน้ำ|ค่าไฟ)/i, name: "ค่าน้ำ ค่าไฟ", type: "expense" },
  { re: /(true\s*(online|move|internet)?|ทรู|ais|เอไอเอส|dtac|ดีแทค|3bb|nt\s|tot|อินเทอร์เน็ต|internet|fiber|ไฟเบอร์|โทรศัพท์|มือถือ|เติมเงิน)/i, name: "ค่าอินเทอร์เน็ต/โทรศัพท์", type: "expense" },
  { re: /(officemate|ออฟฟิศเมท|b2s|เครื่องเขียน|กระดาษ|หมึก|ink|toner|ปากกา|แฟ้ม|เครื่องพิมพ์|printer|วัสดุสำนักงาน|อุปกรณ์สำนักงาน|ไทวัสดุ|thai\s*watsadu|homepro|โฮมโปร|ikea|ดีโฟร์ยู|power\s*buy|banana|advice|jib)/i, name: "อุปกรณ์สำนักงาน/เครื่องเขียน", type: "expense" },
  { re: /(canva|google\s*(workspace|one|cloud)|microsoft|office\s*365|adobe|chatgpt|openai|notion|zoom|capcut|apple\.com|icloud|hosting|โฮสติ้ง|domain|โดเมน|software|ซอฟต์แวร์|subscription|netflix|spotify|youtube)/i, name: "ซอฟต์แวร์/บริการออนไลน์", type: "expense" },
  { re: /(ซ่อม|ช่าง|repair|service\s*center|ทำความสะอาด|แม่บ้าน|cleaning|ล้างแอร์|บำรุง)/i, name: "ซ่อมบำรุง", type: "expense" },
  { re: /(grab(?!\s*(food|express))|bolt|taxi|แท็กซี่|bts|mrt|รถไฟฟ้า|airport\s*rail|ปตท|ptt|shell|เชลล์|bangchak|บางจาก|caltex|คาลเท็กซ์|esso|pt\s*station|น้ำมัน|ทางด่วน|easy\s*pass|m-?flow|ที่จอดรถ|parking|airasia|nok\s*air|thai\s*airways|การบินไทย|รถทัวร์|ค่าเดินทาง)/i, name: "ค่าเดินทาง/น้ำมัน", type: "expense" },
  { re: /(7-?eleven|เซเว่น|ข้าว|อาหาร|กาแฟ|coffee|cafe|คาเฟ่|ก๋วยเตี๋ยว|ชาบู|หมูกระทะ|ส้มตำ|starbucks|amazon\s*cafe|kfc|mcdonald|แมคโดนัลด์|pizza|พิซซ่า|swensen|mk\s*restaurant|bonchon|after\s*you|ชานม|bakery|เบเกอรี่|grab\s*food|lineman|line\s*man|foodpanda|robinhood|shopeefood|น้ำดื่ม|เลี้ยง)/i, name: "อาหาร/รับรองลูกค้า", type: "expense" },
  { re: /(สรรพากร|ภาษี|vat|ภ\.?ง\.?ด|ประกันสังคม|กรมพัฒนาธุรกิจ|dbd|ค่าปรับ|อากร|ราชการ|เทศบาล|อบต)/i, name: "ภาษี/ค่าธรรมเนียมราชการ", type: "expense" },
  { re: /(ค่าธรรมเนียมธนาคาร|ค่าธรรมเนียม|bank\s*fee|ค่าบริการธนาคาร|ค่ารักษาบัญชี)/i, name: "ค่าธรรมเนียมธนาคาร", type: "expense" },
  { re: /(1688|taobao|เถาเป่า|alibaba|aliexpress|makro|แม็คโคร|โรงงาน|ขายส่ง|wholesale|วัตถุดิบ|สต็อก|stock|ซัพพลายเออร์|supplier|lotus|โลตัส|big\s*c|บิ๊กซี|tops|ท็อปส์)/i, name: "ซื้อสินค้า/วัตถุดิบ", type: "expense" },
  // ---- income ----
  { re: /(tiktok|shopee|lazada|line\s*shopping|payout|ถอนเงินจากร้าน|seller)/i, name: "เงินโอนจากแพลตฟอร์ม", type: "income" },
  { re: /(ดอกเบี้ย|interest|เงินคืน|คืนเงิน|refund|cashback|แคชแบ็ก)/i, name: "ดอกเบี้ย/รายได้อื่น", type: "income" },
  { re: /(ลงทุน|เพิ่มทุน|investment|capital|เงินทุน)/i, name: "เงินลงทุน/เงินทุนเพิ่ม", type: "income" },
  { re: /(ค่าบริการ|service|ค่าจ้างงาน|ค่าออกแบบ|ค่าที่ปรึกษา)/i, name: "รายได้ค่าบริการ", type: "income" },
];

export function suggestCategory(input: {
  merchant: string | null | undefined;
  type: CategoryType;
  categories: Pick<Category, "id" | "name" | "type">[];
  rules?: MerchantRule[];
}): CategorySuggestion {
  const cats = input.categories.filter((c) => c.type === input.type);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const byName = (name: string) => cats.find((c) => c.name === name) ?? null;
  const other = byName("อื่น ๆ");
  const fallback: CategorySuggestion = {
    categoryId: other?.id ?? null,
    categoryName: other?.name ?? null,
    confidence: 0.2,
    reason: "ไม่พบข้อมูลพอจะเดาหมวดหมู่ กรุณาเลือกเอง",
  };

  const merchant = normalizeMerchant(input.merchant ?? "");
  if (!merchant) return fallback;

  // 1) learned rules (exact, then contains)
  const rules = (input.rules ?? []).filter((r) => byId.has(r.category_id));
  const exact = rules.find((r) => r.merchant_pattern === merchant);
  if (exact) {
    const c = byId.get(exact.category_id)!;
    return {
      categoryId: c.id,
      categoryName: c.name,
      confidence: Math.min(0.97, 0.85 + exact.hit_count * 0.02),
      reason: `คุณเคยเลือกหมวด "${c.name}" สำหรับร้านนี้`,
    };
  }
  const partial = rules
    .filter((r) => r.merchant_pattern.length >= 3 && (merchant.includes(r.merchant_pattern) || r.merchant_pattern.includes(merchant)))
    .sort((a, b) => b.hit_count - a.hit_count)[0];
  if (partial) {
    const c = byId.get(partial.category_id)!;
    return {
      categoryId: c.id,
      categoryName: c.name,
      confidence: 0.75,
      reason: `ชื่อคล้ายร้านที่คุณเคยเลือกหมวด "${c.name}"`,
    };
  }

  // 2) built-in keywords
  const raw = (input.merchant ?? "").toLowerCase();
  for (const k of KEYWORDS) {
    if (k.type !== input.type || !(k.re.test(merchant) || k.re.test(raw))) continue;
    const c = byName(k.name);
    if (c) return { categoryId: c.id, categoryName: c.name, confidence: 0.65, reason: "เดาจากชื่อร้านค้า" };
  }
  return fallback;
}
