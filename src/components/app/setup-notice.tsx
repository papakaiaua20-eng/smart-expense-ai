export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm" role="alert">
      <p className="font-semibold">ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
      <p className="mt-2 text-slate-700">
        ผู้ดูแลระบบต้องตั้งค่า <code>NEXT_PUBLIC_SUPABASE_URL</code> และ <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ก่อน
        (ดูขั้นตอนใน README)
      </p>
    </div>
  );
}
