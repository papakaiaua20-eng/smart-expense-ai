# Smart Expense AI

เว็บจัดการรายรับ–รายจ่ายที่อ่านสลิปโอนเงินด้วย OCR จัดหมวดหมู่ให้ และสรุปเป็น Dashboard, งบประมาณ, รายงาน
สร้างด้วย Next.js 15 + TypeScript + Tailwind CSS (คอมโพเนนต์สไตล์ shadcn/ui) + Recharts + Supabase (PostgreSQL, Auth, Storage)

> เอกสารออกแบบ (Phase 1: requirements, database, data flow, แผนพัฒนา) อยู่ที่ [`docs/PHASE1.md`](docs/PHASE1.md)

## ทำอะไรได้บ้าง (MVP)

| ฟีเจอร์ | สถานะ |
|---|---|
| สมัคร / เข้าสู่ระบบ / ออกจากระบบ / ลืมรหัสผ่าน | ✅ Supabase Auth |
| แยกข้อมูลตามผู้ใช้ | ✅ Row Level Security ทุกตาราง + ตรวจสิทธิ์ใน API ทุกตัว |
| เพิ่ม / แก้ไข / ลบ / ค้นหา / กรอง / เรียงรายการ | ✅ |
| รายรับ, รายจ่าย, โอนระหว่างบัญชี (ไม่นับเป็นรายรับ/รายจ่าย) | ✅ |
| อัปโหลดหรือถ่ายรูปสลิป → OCR → ตรวจแก้ → ยืนยันก่อนบันทึก | ✅ Tesseract (ไทย+อังกฤษ) บนเซิร์ฟเวอร์เอง หรือ Google Vision |
| อ่าน QR บนสลิปเพื่อได้เลขอ้างอิงที่แม่นยำ | ✅ ทำในเบราว์เซอร์ |
| สถานะ “ต้องตรวจสอบ” เมื่อไม่แน่ใจ, ไม่เดาข้อมูลที่ไม่มีบนสลิป | ✅ |
| ตรวจรายการซ้ำ (เลขอ้างอิง+ยอด, รูปเดิม, ยอด+วันที่+เวลา/ร้าน) | ✅ ซ้ำแน่นอน = บล็อก, อาจซ้ำ = เตือนแล้วให้เลือก |
| เสนอหมวดหมู่ + ความมั่นใจ + จำการเลือกของผู้ใช้ | ✅ |
| Dashboard: การ์ด, Donut, Bar, Line, Progress งบ, รายการล่าสุด, ตัวกรองช่วงเวลา | ✅ |
| งบประมาณรวม / แยกหมวด, เตือนที่ 80% (ปรับได้) / 100% / เกินงบ | ✅ |
| รายงานรายวัน/สัปดาห์/เดือน/ปี, เทียบช่วงก่อน, วิเคราะห์หมวด, CSV | ✅ |
| ตั้งค่า: โปรไฟล์, ชื่อบัญชีของฉัน, หมวดหมู่เอง, ความเป็นส่วนตัว, ลบรูป/ข้อมูล/บัญชี | ✅ |
| PWA (ติดตั้งลงหน้าจอมือถือได้), มือถือใช้ Bottom Navigation, เดสก์ท็อปใช้ Sidebar | ✅ |
| โหมดมืด / สว่าง / ตามเครื่อง (จำค่าในแต่ละเครื่อง) | ✅ ปุ่มที่หัวเว็บ + หน้าตั้งค่า |
| นำเข้าข้อมูลจากแอป “บัญชีออฟฟิศ” (ไฟล์สำรอง .json) | ✅ ตั้งค่า → นำเข้าข้อมูล, ดูตัวอย่างก่อนยืนยัน, นำเข้าซ้ำไม่เพิ่มซ้ำ |
| AI Financial Insights | ระยะต่อไป (ตาม brief) |

## ติดตั้งและรันบนเครื่อง

ต้องมี Node.js 20 ขึ้นไป

```bash
npm install            # ติดตั้งแพ็กเกจ + คัดลอกข้อมูลภาษา OCR ไปที่ ./ocr-data
cp .env.example .env.local
# ใส่ค่า Supabase ใน .env.local (ดูหัวข้อถัดไป)
npm run dev            # เปิด http://localhost:3000
```

### ตั้งค่า Supabase (ครั้งเดียว)

1. สมัคร/เข้าสู่ระบบที่ https://supabase.com แล้วกด **New project** (เลือก Region: Singapore)
2. ไปที่ **SQL Editor** → วางเนื้อหาไฟล์ `supabase/migrations/0001_init.sql` ทั้งหมด → กด **Run** แล้วทำแบบเดียวกันกับ `0002_import_key.sql` , `0003_grants.sql` และ `0004_office_categories.sql` (ตามลำดับ)
   (สร้างตาราง, RLS, หมวดหมู่เริ่มต้นสำหรับผู้ใช้ใหม่, และ bucket รูปสลิปแบบ private)
3. ไปที่ **Project Settings → API** คัดลอก `Project URL` และ `anon public key` ใส่ใน `.env.local`
4. ไปที่ **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (ตอน deploy เปลี่ยนเป็นโดเมนจริง)
   - Redirect URLs: เพิ่ม `http://localhost:3000/auth/callback` และ `https://<โดเมนจริง>/auth/callback`
5. (ถ้าต้องการให้ผู้ใช้ “ลบบัญชีถาวร” ได้) ใส่ `SUPABASE_SERVICE_ROLE_KEY` — เก็บเป็นความลับ ห้ามใส่ใน `NEXT_PUBLIC_*`

หรือใช้ Supabase CLI: `npx supabase link --project-ref <ref>` แล้ว `npx supabase db push`

### ตั้งค่า OCR

| `OCR_PROVIDER` | ความแม่นยำ | ค่าใช้จ่าย | ความเป็นส่วนตัว |
|---|---|---|---|
| `tesseract` (ค่าเริ่มต้น) | ดีกับสลิปที่เป็นภาพหน้าจอ, ด้อยลงกับรูปถ่ายเบลอ | ฟรี | รูปไม่ออกจากเซิร์ฟเวอร์ |
| `google-vision` | ดีมากทั้งภาพหน้าจอและรูปถ่าย | ฟรี 1,000 รูป/เดือน แล้วคิดตามจำนวน | รูปถูกส่งไป Google → แอปขอความยินยอมผู้ใช้ก่อน |
| `none` | – | – | ผู้ใช้อัปโหลดรูปแล้วกรอกเอง |

Google Vision: สร้างโปรเจกต์ที่ https://console.cloud.google.com → เปิด **Cloud Vision API** → สร้าง **API key**
(จำกัด key ให้ใช้ได้เฉพาะ Cloud Vision API) → ใส่ `OCR_PROVIDER=google-vision` และ `GOOGLE_VISION_API_KEY`

เพิ่ม OCR เจ้าอื่น: เขียนคลาสตาม `OcrProvider` ใน `src/lib/ocr/types.ts` แล้วลงทะเบียนใน `src/lib/ocr/index.ts`

## Deploy (แนะนำ Vercel)

1. push โค้ดขึ้น GitHub
2. https://vercel.com → **Add New Project** → เลือก repo
3. ใส่ Environment Variables ตาม `.env.example`
4. Deploy แล้วนำโดเมนที่ได้ไปใส่ใน Supabase **Authentication → URL Configuration**

หมายเหตุ: OCR แบบ Tesseract ใช้ CPU/หน่วยความจำ ครั้งแรกหลัง cold start ใช้เวลาประมาณ 3–6 วินาที
API สแกนตั้ง `maxDuration = 60` วินาที ถ้าผู้ใช้เยอะแนะนำเปลี่ยนเป็น Google Vision
หรือ deploy บนเซิร์ฟเวอร์ที่รัน Node ต่อเนื่อง (Railway, Render, Fly.io, VPS: `npm run build && npm start`)

## ทดสอบ

```bash
npm test               # unit tests: ตัวอ่านสลิป, การคำนวณสรุป/งบ, ช่วงวันที่, ตรวจซ้ำ, จัดหมวด, CSV
npm run typecheck
npm run lint
DATABASE_URL=postgres://postgres@localhost/postgres npm run test:db
                       # ทดสอบ migration + RLS บน PostgreSQL ธรรมดา: ผู้ใช้ A ไม่เห็น/แก้ข้อมูลผู้ใช้ B,
                       # ห้ามบันทึกเลขอ้างอิงซ้ำ, ห้ามใช้หมวดของคนอื่น, ห้ามอัปโหลดรูปเข้าโฟลเดอร์คนอื่น
```

## โครงสร้างโปรเจกต์

```
src/
  app/
    (marketing)/page.tsx         Landing page
    (auth)/                      login, register, forgot-password, reset-password
    (app)/                       dashboard, transactions, scan, budget, reports, settings (ต้องล็อกอิน)
    api/                         REST API (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกตัว)
    auth/callback, auth/signout
    privacy/                     นโยบายความเป็นส่วนตัว (แม่แบบ)
  components/ui/                 ปุ่ม, ฟอร์ม, dialog ฯลฯ (สไตล์ shadcn/ui)
  components/app/                ฟอร์มรายการ, กราฟ, เมนู
  lib/
    slip/parser.ts               แยกข้อมูลจากข้อความสลิป (ไทย/อังกฤษ, พ.ศ./ค.ศ., ฟิลด์ + ความมั่นใจ)
    slip/qr.ts, slip/banks.ts    อ่าน QR ยืนยันสลิป, รายชื่อธนาคาร
    ocr/                         Adapter: tesseract, google-vision
    categorize.ts                เสนอหมวดหมู่
    dedupe.ts                    ตรวจรายการซ้ำ
    summary.ts                   คำนวณ Dashboard/งบ/รายงาน (นับเป็นสตางค์ ไม่ใช้ทศนิยม float)
    validation.ts                zod schemas ฝั่งเซิร์ฟเวอร์
supabase/migrations/0001_init.sql
supabase/tests/                  ทดสอบ RLS
tests/                           unit tests
```

## API

ทุก endpoint ต้องล็อกอิน (cookie session) และเข้าถึงได้เฉพาะข้อมูลของตัวเอง

| Method | Path | หน้าที่ |
|---|---|---|
| POST | `/api/receipts/scan` | multipart `file` (+`qr`) → เก็บรูป, OCR, แยกข้อมูล, ตรวจซ้ำ, เสนอหมวด (ไม่บันทึกรายการ) |
| GET | `/api/receipts/:id/image` | ลิงก์รูปสลิปชั่วคราว 60 วินาที |
| DELETE | `/api/receipts` | ลบรูปสลิปทั้งหมด |
| GET / POST | `/api/transactions` | รายการ (กรอง/ค้นหา/เรียง/แบ่งหน้า) / สร้าง (409 ถ้าซ้ำ, ส่ง `confirm_duplicate` เพื่อยืนยันกรณี “อาจซ้ำ”) |
| PATCH / DELETE | `/api/transactions/:id` | แก้ไข / ลบ |
| GET | `/api/dashboard/summary?range=today\|7d\|this_month\|last_month\|this_year\|custom&from&to` | สรุป |
| GET | `/api/reports?from&to&granularity=day\|week\|month\|year` | รายงาน + เทียบช่วงก่อน |
| GET | `/api/reports/export?from&to` | CSV |
| GET / POST | `/api/budgets?month=YYYY-MM` | งบ + การใช้ / สร้างงบ |
| PATCH / DELETE | `/api/budgets/:id` | แก้ไข / ลบงบ |
| GET / POST / PATCH / DELETE | `/api/categories[/:id]` | หมวดหมู่ |
| POST | `/api/categories/suggest` | เสนอหมวดจากชื่อร้าน |
| GET / PATCH | `/api/profile` | โปรไฟล์, ชื่อบัญชีของฉัน, การตั้งค่า |
| POST | `/api/import/office-ledger` (`?dry_run=1` = ดูตัวอย่าง) | นำเข้าไฟล์สำรองจากบัญชีออฟฟิศ |
| DELETE | `/api/account` | ลบข้อมูลทั้งหมด (และบัญชี ถ้าตั้ง service role key) |

## ข้อควรรู้

- ระบบ **ไม่บันทึกอัตโนมัติ**: ทุกสลิปต้องให้ผู้ใช้ตรวจและกด “ยืนยันและบันทึก” ตาม brief
- รายรับหรือรายจ่ายจากสลิป ตัดสินจาก “ชื่อบัญชีของฉัน” ในหน้าตั้งค่าเท่านั้น (ไม่เดาจากชื่อธนาคาร/ผู้รับ) ถ้าไม่ตรงจะให้ผู้ใช้เลือก
- “คงเหลือสุทธิ” = รายรับ − รายจ่ายของช่วงที่เลือก ไม่ใช่ยอดเงินในบัญชีธนาคาร
- ข้อความ OCR ที่เก็บในฐานข้อมูลจะปิดบังเลขบัญชีเหลือ 4 หลักท้าย
- รูปสลิปที่อัปโหลดแต่ไม่ได้บันทึกเป็นรายการจะยังอยู่ในพื้นที่ส่วนตัว ผู้ใช้ลบได้ที่ ตั้งค่า → ลบรูปสลิปทั้งหมด
  (ถ้าต้องการลบอัตโนมัติ ตั้ง Supabase Cron ให้ลบ `receipts` ที่ไม่มี transaction และเก่ากว่า N วัน)
- หน้า `/privacy` เป็นแม่แบบ ต้องเติมชื่อผู้ควบคุมข้อมูล/ช่องทางติดต่อ และให้ผู้เชี่ยวชาญกฎหมายตรวจก่อนเปิดจริง (PDPA)
