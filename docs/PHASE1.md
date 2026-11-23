# Phase 1: วิเคราะห์ระบบ ออกแบบฐานข้อมูล และแผนพัฒนา

## 1. สรุป Requirements และขอบเขต MVP

**ผู้ใช้:** พนักงานประจำ ฟรีแลนซ์ เจ้าของธุรกิจเล็ก บุคคลทั่วไป ใช้บนมือถือเป็นหลัก ภาษาไทย สกุลเงิน THB

**MVP (ต้องทำงานจริง):** สมาชิก, Dashboard, เพิ่มรายการเอง, อัปโหลด+OCR สลิป, ตรวจแก้ก่อนบันทึก, จัดหมวดหมู่,
ประวัติรายการ, แก้ไข/ลบ, กราฟ, ฐานข้อมูลจริง — และเพิ่มงบประมาณ, รายงาน+CSV, ตั้งค่า เพราะอยู่ในโครงหน้าเว็บของ brief

**ไม่อยู่ใน MVP:** เชื่อมบัญชีธนาคาร, สมาชิกแบบเสียเงิน, AI chatbot, อ่านคลังรูปเบื้องหลัง, push notification, AI Insights

### การตัดสินใจสำคัญ

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| Framework | Next.js 15 App Router + Route Handlers | ตรง brief, API ตาม path ที่กำหนด |
| DB/Auth/Storage | Supabase | Postgres + Auth + private Storage + RLS ในที่เดียว |
| OCR | Adapter: Tesseract (ค่าเริ่มต้น) / Google Vision / none | ใช้ได้ทันทีโดยไม่ต้องมี API key และรูปไม่ออกจากเซิร์ฟเวอร์ (PDPA); เปลี่ยนเป็น Google Vision ได้เมื่อต้องการความแม่นยำสูง |
| QR บนสลิป | ถอดรหัสในเบราว์เซอร์ (jsQR) ส่งไปพร้อมรูป | ได้เลขอ้างอิงและรหัสธนาคารที่แม่นยำกว่า OCR |
| รายรับ/รายจ่ายจากสลิป | เทียบชื่อบนสลิปกับ “ชื่อบัญชีของฉัน” ที่ผู้ใช้ตั้ง | brief ห้ามตัดสินจากชื่อธนาคาร/ผู้รับอย่างเดียว |
| การบันทึก | ไม่บันทึกอัตโนมัติ ต้องยืนยันทุกครั้ง | brief ข้อ 3.2 |
| จำนวนเงิน | `NUMERIC(14,2)` ใน DB, รวมยอดเป็นสตางค์ (integer) ในโค้ด | ไม่มีปัญหาทศนิยม float |
| เวลา | วันที่ทำรายการเก็บเป็น `date` ตามเวลาไทย (Asia/Bangkok) | ช่วง “วันนี้/เดือนนี้” ถูกต้องตามเวลาไทย |
| โอนระหว่างบัญชี | type = `transfer` ไม่มีหมวด ไม่นับในรายรับ/รายจ่าย | ยอดรวมไม่ผิด |

## 2. Database Schema

ไฟล์: `supabase/migrations/0001_init.sql`

```
auth.users (Supabase)
  └── profiles            id(=auth.users.id) email display_name currency account_names[] keep_receipt_images ocr_consent_at
  └── categories          id user_id name type(income|expense) icon color is_default sort_order
  └── receipts            id user_id storage_path mime_type file_size file_hash ocr_status ocr_provider raw_text(masked) extracted_data(jsonb) confidence_score
  └── transactions        id user_id type(income|expense|transfer) amount NUMERIC currency category_id merchant_name
                          transaction_date transaction_time payment_method bank sender_name receiver_name reference_number
                          source(manual|ocr|import) receipt_id note
  └── budgets             id user_id category_id(null=งบรวม) amount period_start period_end alert_threshold
  └── merchant_rules      id user_id merchant_pattern category_id hit_count
  └── notification_settings id user_id budget_alert_enabled
storage.buckets: receipts (private, 5 MB, jpeg/png/webp), path = <user_id>/<uuid>.<ext>
```

ข้อกำหนดที่ทำแล้ว:
- UUID เป็น PK ทุกตาราง, `NUMERIC` สำหรับเงิน, CHECK amount > 0
- FK แบบ composite `(category_id, user_id)` → ใช้หมวดของผู้ใช้อื่นไม่ได้แม้รู้ id
- Index: `(user_id, transaction_date desc)`, `(user_id, category_id)`, receipts `(user_id, file_hash)`
- Unique: `(user_id, reference_number, amount)` เมื่อมีเลขอ้างอิง → กันบันทึกซ้ำระดับฐานข้อมูล
- Unique งบ `(user_id, category_id, period)` แบบ `NULLS NOT DISTINCT`
- RLS เปิดทุกตาราง policy `user_id = auth.uid()`, Storage policy ตามโฟลเดอร์ user id
- Trigger สร้าง profile + หมวดเริ่มต้น 16 หมวด + notification settings ให้ผู้ใช้ใหม่

## 3. Data Flow

### สแกนสลิป
```
เบราว์เซอร์: เลือก/ถ่ายรูป → ย่อรูปถ้า > 5MB → อ่าน QR (jsQR) → POST /api/receipts/scan
เซิร์ฟเวอร์: ตรวจล็อกอิน → rate limit (30/ชม.) → ตรวจชนิดไฟล์จาก magic bytes + ขนาด
  → (ถ้า OCR ภายนอก) ตรวจความยินยอม → hash รูป (รูปเดิม?) → เก็บรูป private
  → OCR → parseSlip (ทุกฟิลด์มี value/confidence/status: ok|review|missing)
  → ตรวจซ้ำ → เสนอหมวด → บันทึกผลใน receipts → ส่งกลับ (ยังไม่สร้าง transaction)
เบราว์เซอร์: แสดงฟอร์ม ช่องไม่แน่ใจเป็นสีเหลือง “ต้องตรวจสอบ” → ผู้ใช้แก้/ยืนยัน
  → POST /api/transactions (ตรวจ validation + ซ้ำอีกครั้ง) → จำหมวดของร้านนี้ → Dashboard อัปเดต
```

### เพิ่มเอง
ฟอร์ม → validate ฝั่ง client → POST /api/transactions → zod ฝั่งเซิร์ฟเวอร์ → ตรวจหมวดตรงประเภท → ตรวจซ้ำ → บันทึก

## 4. Wireframe (สรุปโครงหน้าจอ)

- มือถือ: header (โลโก้, ตั้งค่า) + เนื้อหา 1 คอลัมน์ + Bottom Nav 5 เมนู (ปุ่มสแกนเด่นตรงกลาง)
- เดสก์ท็อป: Sidebar ซ้าย + เนื้อหา max 1152px
- Dialog เป็น bottom sheet บนมือถือ (กดด้วยมือเดียวได้), ปุ่มบันทึกติดด้านล่าง
- ทุกหน้ามี Loading / Empty / Error state, ลบต้องยืนยันผ่าน dialog

## 5. แผนพัฒนา (สถานะ)

| Step | งาน | สถานะ |
|---|---|---|
| 1 | Requirements + ขอบเขต MVP | ✅ |
| 2 | Database + Data flow | ✅ ทดสอบ RLS อัตโนมัติ |
| 3 | Wireframe | ✅ (ทำเป็น UI จริงโดยตรง) |
| 4 | UI components + responsive | ✅ |
| 5 | Auth + Database | ✅ |
| 6 | Transactions | ✅ |
| 7 | OCR + ตรวจสลิป | ✅ Tesseract ใช้งานได้จริง, ต้องทดสอบกับสลิปจริงหลายธนาคารเพิ่ม |
| 8 | Dashboard + กราฟ | ✅ |
| 9 | ทดสอบ ความปลอดภัย responsive | ✅ unit + RLS + e2e บน Supabase local |
| 10 | Deploy | รอโปรเจกต์ Supabase + Vercel ของเจ้าของ |

## 6. ระยะต่อไป
- AI Financial Insights (ใช้ข้อมูลจริง แสดงสูตรและช่วงเวลา) — ต้องมีการแจ้งและความยินยอมก่อนส่งข้อมูลไป AI provider
- ทดสอบ parser กับสลิปจริงของทุกธนาคารและปรับ pattern
- ลบรูปสลิปที่ไม่ได้ใช้อัตโนมัติ (Supabase Cron)
- Offline/Service worker สำหรับ PWA
