import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiError, withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/receipts/:id/image -> short-lived signed URL (owner only, via RLS)
export const GET = withUser<Ctx>(async ({ supabase, ctx }) => {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "ไม่พบรูป");
  const { data } = await supabase.from("receipts").select("storage_path").eq("id", id).maybeSingle();
  if (!data?.storage_path) throw new ApiError(404, "ไม่พบรูป หรือรูปถูกลบแล้ว");
  const { data: signed, error } = await supabase.storage.from("receipts").createSignedUrl(data.storage_path, 60);
  if (error || !signed) throw new ApiError(404, "ไม่พบรูป");
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
});
