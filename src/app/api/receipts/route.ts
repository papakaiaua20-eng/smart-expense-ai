import { dbError, json, withUser } from "@/lib/api";

// DELETE /api/receipts  -> delete all slip images (transactions are kept)
export const DELETE = withUser(async ({ supabase }) => {
  const { data, error } = await supabase.from("receipts").select("id,storage_path").not("storage_path", "is", null);
  dbError(error);
  const paths = (data ?? []).map((r) => r.storage_path as string);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from("receipts").remove(paths.slice(i, i + 100));
  }
  const { error: e2 } = await supabase
    .from("receipts")
    .update({ storage_path: null, raw_text: null })
    .not("id", "is", null);
  dbError(e2);
  return json({ ok: true, deleted: paths.length });
});
