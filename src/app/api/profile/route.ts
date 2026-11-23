import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { getOcrProvider } from "@/lib/ocr";
import { profilePatch, zodMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = withUser(async ({ supabase, user }) => {
  const [p, n] = await Promise.all([
    supabase.from("profiles").select("email,display_name,currency,account_names,keep_receipt_images,ocr_consent_at").eq("id", user.id).single(),
    supabase.from("notification_settings").select("budget_alert_enabled").eq("user_id", user.id).maybeSingle(),
  ]);
  dbError(p.error);
  const provider = getOcrProvider();
  return json({
    profile: { ...p.data, budget_alert_enabled: n.data?.budget_alert_enabled ?? true },
    ocr: provider ? { id: provider.id, label: provider.label, external: provider.external } : null,
  });
});

export const PATCH = withUser(async ({ req, supabase, user }) => {
  const parsed = profilePatch.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const { budget_alert_enabled, ocr_consent, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (ocr_consent !== undefined) update.ocr_consent_at = ocr_consent ? new Date().toISOString() : null;
  if (Object.keys(update).length) {
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    dbError(error);
  }
  if (budget_alert_enabled !== undefined) {
    const { error } = await supabase
      .from("notification_settings")
      .upsert({ user_id: user.id, budget_alert_enabled, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    dbError(error);
  }
  return json({ ok: true });
});
