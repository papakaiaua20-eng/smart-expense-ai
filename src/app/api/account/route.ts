import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

// DELETE /api/account  body: { confirm: "ลบข้อมูล", delete_account?: boolean }
// Deletes all of the user's financial data and slip images (PDPA right to erasure).
// With delete_account and SUPABASE_SERVICE_ROLE_KEY set, the login itself is removed too.
export const DELETE = withUser(async ({ req, supabase, user }) => {
  const body = (await readJson(req)) as { confirm?: string; delete_account?: boolean };
  if (body?.confirm !== "ลบข้อมูล") throw new ApiError(400, 'กรุณาพิมพ์คำว่า "ลบข้อมูล" เพื่อยืนยัน');

  const { data: recs } = await supabase.from("receipts").select("storage_path").not("storage_path", "is", null);
  const paths = (recs ?? []).map((r) => r.storage_path as string);
  for (let i = 0; i < paths.length; i += 100) await supabase.storage.from("receipts").remove(paths.slice(i, i + 100));

  for (const table of ["transactions", "budgets", "merchant_rules", "receipts"]) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    dbError(error);
  }

  if (body.delete_account) {
    const admin = createAdminClient();
    if (!admin) throw new ApiError(501, "ลบข้อมูลการเงินแล้ว แต่การลบบัญชีผู้ใช้ต้องตั้งค่า SUPABASE_SERVICE_ROLE_KEY ก่อน");
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new ApiError(500, "ลบบัญชีไม่สำเร็จ");
    await supabase.auth.signOut();
  }
  return json({ ok: true });
});
