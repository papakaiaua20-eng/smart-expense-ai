import Link from "next/link";
import { BarChart3, Bell, Camera, CheckCircle2, FileSpreadsheet, Lock, ScanLine, Sparkles, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";

const FEATURES = [
  { icon: ScanLine, title: "อ่านสลิปอัตโนมัติ", text: "อัปโหลดหรือถ่ายรูปสลิป ระบบอ่านยอดเงิน วันที่ เวลา ธนาคาร และเลขอ้างอิงให้ คุณแค่ตรวจแล้วกดยืนยัน" },
  { icon: Tags, title: "จัดหมวดหมู่ให้เอง", text: "เสนอหมวดหมู่จากชื่อร้านค้า บอกระดับความมั่นใจ และจำสิ่งที่คุณเลือกไว้ใช้ครั้งต่อไป" },
  { icon: CheckCircle2, title: "กันบันทึกซ้ำ", text: "ตรวจรายการซ้ำจากเลขอ้างอิงและข้อมูลธุรกรรม เตือนก่อนบันทึกทุกครั้ง" },
  { icon: BarChart3, title: "Dashboard เข้าใจง่าย", text: "รายรับ รายจ่าย ยอดสุทธิ สัดส่วนตามหมวด และแนวโน้ม เลือกช่วงเวลาได้" },
  { icon: Bell, title: "งบประมาณและการเตือน", text: "ตั้งงบรวมหรือแยกหมวด เตือนเมื่อใช้ถึง 80%, 100% และเมื่อเกินงบ" },
  { icon: FileSpreadsheet, title: "รายงานและ CSV", text: "สรุปรายวันถึงรายปี เทียบช่วงก่อน และดาวน์โหลดเป็น CSV เปิดใน Excel ได้" },
];

const STEPS = [
  { icon: Camera, title: "1. ถ่ายหรืออัปโหลดสลิป", text: "รองรับ JPG, PNG, WEBP จากมือถือหรือคอมพิวเตอร์" },
  { icon: Sparkles, title: "2. ตรวจข้อมูลที่ระบบอ่านได้", text: "ช่องที่ไม่แน่ใจจะขึ้นว่า “ต้องตรวจสอบ” แก้ได้ทุกช่อง" },
  { icon: BarChart3, title: "3. ดูสรุปทันที", text: "Dashboard และงบประมาณอัปเดตจากข้อมูลที่บันทึกจริง" },
];

const FAQ = [
  { q: "ใช้ฟรีไหม?", a: "เวอร์ชันนี้ใช้งานได้ฟรี" },
  { q: "รองรับสลิปธนาคารไหนบ้าง?", a: "ออกแบบให้อ่านสลิปภาษาไทยของธนาคารหลัก เช่น กสิกรไทย ไทยพาณิชย์ กรุงไทย กรุงเทพ กรุงศรี ทีทีบี ออมสิน และพร้อมเพย์ ถ้าอ่านไม่ได้ คุณกรอกเองได้เสมอ" },
  { q: "ระบบบันทึกรายการเองโดยไม่ถามไหม?", a: "ไม่ ทุกสลิปต้องผ่านการตรวจและกดยืนยันจากคุณก่อนบันทึก" },
  { q: "ยอด “คงเหลือสุทธิ” คือเงินในบัญชีหรือเปล่า?", a: "ไม่ใช่ เป็นรายรับลบรายจ่ายของช่วงเวลาที่เลือก ไม่ใช่ยอดเงินจริงในบัญชีธนาคาร" },
  { q: "ข้อมูลของฉันปลอดภัยไหม?", a: "ข้อมูลแยกตามบัญชีผู้ใช้ด้วย Row Level Security รูปสลิปเก็บในพื้นที่ส่วนตัว และคุณลบรูปหรือข้อมูลทั้งหมดได้เองในหน้าตั้งค่า" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Smart Expense AI">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="เมนูหลัก">
            <a href="#features" className="hover:text-foreground">ฟีเจอร์</a>
            <a href="#how" className="hover:text-foreground">วิธีใช้งาน</a>
            <a href="#faq" className="hover:text-foreground">คำถามที่พบบ่อย</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">เข้าสู่ระบบ</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">เริ่มใช้งานฟรี</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> AI ช่วยจดรายรับ–รายจ่าย
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
            จดรายจ่ายง่าย ๆ
            <br />
            <span className="text-primary">แค่สแกนสลิป</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            ไม่ต้องจดเองอีกต่อไป อัปโหลดสลิปโอนเงิน ระบบอ่านข้อมูล จัดหมวดหมู่ และสรุปให้เห็นว่าเงินไปไหน
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">เริ่มใช้งานฟรี</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">มีบัญชีแล้ว เข้าสู่ระบบ</Link>
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" /> ข้อมูลของคุณเห็นได้เฉพาะคุณ
          </p>
        </div>

        {/* Illustration of the dashboard (clearly labelled sample, not real data) */}
        <figure className="relative mx-auto w-full max-w-md" aria-label="ภาพตัวอย่าง Dashboard">
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-xl shadow-blue-900/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ภาพรวมเดือนนี้</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-muted">ภาพตัวอย่าง</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["รายรับ", "text-income", "bg-green-50"],
                ["รายจ่าย", "text-expense", "bg-red-50"],
                ["สุทธิ", "text-primary", "bg-blue-50"],
              ].map(([l, c, bg]) => (
                <div key={l} className={`rounded-xl ${bg} p-3`}>
                  <p className="text-[11px] text-muted">{l}</p>
                  <div className={`mx-auto mt-2 h-2.5 w-14 rounded-full ${c} bg-current opacity-60`} />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end gap-1.5" aria-hidden>
              {[40, 65, 30, 80, 55, 70, 45, 90, 60, 50, 75, 35].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col justify-end gap-0.5" style={{ height: 96 }}>
                  <div className="rounded-t bg-income/70" style={{ height: `${(h * 0.6) | 0}%` }} />
                  <div className="rounded-t bg-expense/70" style={{ height: `${(100 - h) * 0.4 | 0}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2.5" aria-hidden>
              {["#F97316", "#0EA5E9", "#EC4899"].map((c, i) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="size-8 rounded-lg" style={{ background: c }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2 w-2/3 rounded-full bg-slate-200" />
                    <div className="h-2 w-1/3 rounded-full bg-slate-100" />
                  </div>
                  <div className="h-2.5 rounded-full bg-red-200" style={{ width: 40 + i * 8 }} />
                </div>
              ))}
            </div>
          </div>
          <figcaption className="sr-only">ภาพจำลองหน้าจอ Dashboard ไม่ใช่ข้อมูลจริง</figcaption>
        </figure>
      </section>

      <section id="features" className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-semibold">ทุกอย่างที่ต้องใช้ในการคุมเงิน</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border p-5">
                <f.icon className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-semibold">ใช้งานง่ายใน 3 ขั้นตอน</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-2xl bg-surface p-6 text-center shadow-sm ring-1 ring-border">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                <s.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="border-t border-border bg-surface py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-semibold">คำถามที่พบบ่อย</h2>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-muted transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg">
              <Link href="/register">เริ่มใช้งานฟรี</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted">
        <span>© {new Date().getFullYear()} Smart Expense AI</span>
        <Link href="/privacy" className="hover:text-foreground">นโยบายความเป็นส่วนตัว</Link>
      </footer>
    </div>
  );
}
