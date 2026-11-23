import Link from "next/link";
import { Logo } from "@/components/app/logo";

export const dynamic = "force-dynamic";

export const metadata = { title: "นโยบายความเป็นส่วนตัว" };

// Template policy: the site owner must review and complete it (controller name, contact, legal basis) before launch.
export default function Privacy() {
  const provider = (process.env.OCR_PROVIDER ?? "tesseract").toLowerCase();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/"><Logo /></Link>
      <h1 className="mt-8 text-3xl font-semibold">นโยบายความเป็นส่วนตัว</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-foreground">ข้อมูลที่เราเก็บ</h2>
          <ul className="list-disc pl-5">
            <li>อีเมลและรหัสผ่าน (รหัสผ่านเก็บแบบเข้ารหัสทางเดียว ไม่มีใครอ่านได้)</li>
            <li>รายการรายรับ–รายจ่าย หมวดหมู่ งบประมาณ ที่คุณบันทึก</li>
            <li>รูปสลิปที่คุณอัปโหลด และข้อความที่อ่านได้จากสลิป (เลขบัญชีถูกปิดบังบางส่วน)</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">วัตถุประสงค์</h2>
          <p>ใช้เพื่อให้บริการบันทึกและสรุปข้อมูลการเงินของคุณเท่านั้น ไม่ขายหรือเปิดเผยข้อมูลให้บุคคลอื่นเพื่อการตลาด</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">การอ่านสลิป (OCR)</h2>
          <p>
            {provider === "google-vision"
              ? "รูปสลิปจะถูกส่งไปยัง Google Cloud Vision เพื่ออ่านข้อความ หลังจากคุณกดยินยอมในหน้าสแกนสลิปเท่านั้น คุณถอนความยินยอมได้ในหน้าตั้งค่า"
              : "รูปสลิปถูกอ่านด้วยระบบ OCR บนเซิร์ฟเวอร์ของเว็บไซต์เอง ไม่ได้ส่งไปยังผู้ให้บริการ AI ภายนอก"}
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">การจัดเก็บและความปลอดภัย</h2>
          <p>
            ข้อมูลเก็บในฐานข้อมูลที่จำกัดสิทธิ์ให้เจ้าของบัญชีเข้าถึงได้เท่านั้น รูปสลิปเก็บในพื้นที่ส่วนตัว
            การเปิดดูรูปใช้ลิงก์ชั่วคราวที่หมดอายุใน 60 วินาที การเชื่อมต่อทั้งหมดผ่าน HTTPS
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">สิทธิ์ของคุณตาม PDPA</h2>
          <p>
            คุณขอดู ส่งออก (CSV) แก้ไข หรือลบข้อมูลของคุณได้ ในหน้า <Link href="/settings" className="text-primary underline">ตั้งค่า</Link>{" "}
            มีปุ่มลบรูปสลิปทั้งหมด ลบข้อมูลการเงินทั้งหมด และลบบัญชีถาวร
          </p>
        </section>
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          หมายเหตุสำหรับผู้ดูแลเว็บไซต์: นี่เป็นแม่แบบ กรุณาเพิ่มชื่อผู้ควบคุมข้อมูล ช่องทางติดต่อ ระยะเวลาเก็บข้อมูล
          และให้ผู้เชี่ยวชาญด้านกฎหมายตรวจสอบก่อนเปิดใช้งานจริง
        </p>
      </div>
    </main>
  );
}
