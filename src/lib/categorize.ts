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

// keyword -> default category name (must match names seeded in the migration)
const KEYWORDS: { re: RegExp; name: string; type: CategoryType }[] = [
  { re: /(7-?eleven|เซเว่น|ข้าว|อาหาร|กาแฟ|coffee|cafe|คาเฟ่|ก๋วยเตี๋ยว|ชาบู|หมูกระทะ|ส้มตำ|starbucks|amazon\s*cafe|kfc|mcdonald|แมคโดนัลด์|pizza|พิซซ่า|swensen|mk\s*restaurant|bonchon|after\s*you|ชานม|bakery|เบเกอรี่|grab\s*food|lineman|line\s*man|foodpanda|robinhood|shopeefood)/i, name: "อาหารและเครื่องดื่ม", type: "expense" },
  { re: /(grab(?!\s*food)|bolt|taxi|แท็กซี่|bts|mrt|รถไฟฟ้า|airport\s*rail|ปตท|ptt|shell|เชลล์|bangchak|บางจาก|caltex|คาลเท็กซ์|esso|pt\s*station|น้ำมัน|ทางด่วน|easy\s*pass|m-?flow|ที่จอดรถ|parking|airasia|nok\s*air|thai\s*airways|การบินไทย|รถทัวร์|ขนส่ง)/i, name: "เดินทาง", type: "expense" },
  { re: /(shopee(?!\s*food)|lazada|central|เซ็นทรัล|robinson|โรบินสัน|uniqlo|h&m|zara|lotus|โลตัส|big\s*c|บิ๊กซี|makro|แม็คโคร|tops|ท็อปส์|villa\s*market|watsons|วัตสัน|boots|eveandboy|power\s*buy|banana|advice|ikea|homepro|โฮมโปร|thai\s*watsadu|ไทวัสดุ|global\s*house|tiktok\s*shop|amazon)/i, name: "ช้อปปิ้ง", type: "expense" },
  { re: /(ค่าเช่า|ค่าห้อง|หอพัก|คอนโด|condo|apartment|อพาร์ทเม้นท์|นิติบุคคล|ค่าส่วนกลาง|บ้าน)/i, name: "บ้านและที่อยู่อาศัย", type: "expense" },
  { re: /(การไฟฟ้า|ไฟฟ้า|pea|mea|การประปา|ประปา|pwa|mwa|true\s*(online|move|internet)?|ทรู|ais|เอไอเอส|dtac|ดีแทค|3bb|nt\s|tot|อินเทอร์เน็ต|internet|fiber|ไฟเบอร์)/i, name: "ค่าน้ำ ค่าไฟ อินเทอร์เน็ต", type: "expense" },
  { re: /(โรงพยาบาล|hospital|คลินิก|clinic|ร้านยา|pharmacy|ฟาร์มาซี|ทันตกรรม|dental|fitness|ฟิตเนส|gym|ยิม|ประกันสุขภาพ)/i, name: "สุขภาพ", type: "expense" },
  { re: /(โรงเรียน|school|มหาวิทยาลัย|university|ค่าเทอม|tuition|course|คอร์ส|udemy|coursera|skooldio|หนังสือ|book|se-ed|ซีเอ็ด|นายอินทร์|kinokuniya)/i, name: "การศึกษา", type: "expense" },
  { re: /(netflix|spotify|youtube|disney|hbo|viu|wetv|apple\.com|itunes|google\s*play|steam|playstation|nintendo|major|เมเจอร์|sf\s*cinema|เอสเอฟ|cinema|โรงหนัง|คอนเสิร์ต|concert|ticket|บัตรคอนเสิร์ต|karaoke|คาราโอเกะ)/i, name: "ความบันเทิง", type: "expense" },
  { re: /(ผ่อน|สินเชื่อ|loan|บัตรเครดิต|credit\s*card|ktc|aeon|อิออน|first\s*choice|เฟิร์สช้อยส์|cardx|umay|ยูเมะ|ไฟแนนซ์|finance|leasing|ลีสซิ่ง|ประกัน|insurance)/i, name: "ผ่อนชำระและหนี้สิน", type: "expense" },
  { re: /(เงินเดือน|salary|payroll)/i, name: "เงินเดือน", type: "income" },
  { re: /(คอมมิชชั่น|คอมมิชชัน|commission)/i, name: "ค่าคอมมิชชัน", type: "income" },
  { re: /(คืนเงิน|เงินคืน|refund|cashback|แคชแบ็ก)/i, name: "เงินคืน", type: "income" },
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
