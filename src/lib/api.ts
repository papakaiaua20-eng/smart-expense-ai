import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { supabaseEnv } from "./env";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Every API handler goes through this: checks login on the server and maps errors to JSON. */
export function withUser<Ctx = unknown>(
  handler: (args: { req: Request; supabase: SupabaseClient; user: User; ctx: Ctx }) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      if (!supabaseEnv().configured) throw new ApiError(503, "ยังไม่ได้ตั้งค่า Supabase (ดู README)");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
      return await handler({ req, supabase, user, ctx });
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message, ...e.extra }, e.status);
      console.error("[api]", e);
      return json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" }, 500);
    }
  };
}

export function dbError(error: { code?: string; message: string } | null): never | void {
  if (!error) return;
  if (error.code === "23505") throw new ApiError(409, "มีข้อมูลนี้อยู่แล้ว", { code: "duplicate" });
  if (error.code === "23503") throw new ApiError(400, "ข้อมูลอ้างอิงไม่ถูกต้อง");
  if (error.code === "PGRST116") throw new ApiError(404, "ไม่พบข้อมูล");
  console.error("[db]", error);
  throw new ApiError(500, "บันทึกข้อมูลไม่สำเร็จ");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
