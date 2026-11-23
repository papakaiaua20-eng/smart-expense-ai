"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Email not confirmed": "กรุณายืนยันอีเมลก่อน (ตรวจสอบกล่องจดหมาย)",
  "User already registered": "อีเมลนี้สมัครสมาชิกแล้ว",
};
const thaiError = (m: string) => AUTH_ERRORS[m] ?? (/rate limit/i.test(m) ? "ลองบ่อยเกินไป กรุณารอสักครู่" : m);

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(sp.get("error") === "link" ? "ลิงก์หมดอายุหรือไม่ถูกต้อง" : null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    setLoading(false);
    if (error) return setError(thaiError(error.message));
    router.replace(safeNext(sp.get("next")));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
        <CardDescription>ยินดีต้อนรับกลับมา</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 block">อีเมล</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">ลืมรหัสผ่าน?</Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-expense" role="alert">{error}</p>}
          <Button type="submit" loading={loading}>เข้าสู่ระบบ</Button>
          <p className="text-center text-sm text-muted">
            ยังไม่มีบัญชี? <Link href="/register" className="text-primary hover:underline">สมัครสมาชิก</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (password !== String(f.get("confirm"))) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    if (!f.get("accept")) return setError("กรุณายอมรับนโยบายความเป็นส่วนตัว");
    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) return setError(thaiError(error.message));
    if (data.session) {
      toast.success("สมัครสมาชิกสำเร็จ");
      router.replace("/dashboard");
      router.refresh();
    } else setSent(email);
  }

  if (sent)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ตรวจสอบอีเมลของคุณ</CardTitle>
          <CardDescription>เราส่งลิงก์ยืนยันไปที่ {sent} แล้ว กดลิงก์ในอีเมลเพื่อเริ่มใช้งาน</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">สมัครสมาชิก</CardTitle>
        <CardDescription>เริ่มใช้งานฟรี ข้อมูลของคุณเห็นได้เฉพาะคุณ</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 block">อีเมล</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password" className="mb-1.5 block">รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <Label htmlFor="confirm" className="mb-1.5 block">ยืนยันรหัสผ่าน</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="accept" className="mt-1 size-4" />
            <span>
              ฉันยอมรับ <Link href="/privacy" className="text-primary hover:underline" target="_blank">นโยบายความเป็นส่วนตัว</Link>
            </span>
          </label>
          {error && <p className="text-sm text-expense" role="alert">{error}</p>}
          <Button type="submit" loading={loading}>สมัครสมาชิก</Button>
          <p className="text-center text-sm text-muted">
            มีบัญชีแล้ว? <Link href="/login" className="text-primary hover:underline">เข้าสู่ระบบ</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ForgotForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) return setError(thaiError(error.message));
    setSent(true);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">ลืมรหัสผ่าน</CardTitle>
        <CardDescription>
          {sent ? "ถ้าอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว" : "กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!sent && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email" className="mb-1.5 block">อีเมล</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {error && <p className="text-sm text-expense" role="alert">{error}</p>}
            <Button type="submit" loading={loading}>ส่งลิงก์</Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">กลับไปหน้าเข้าสู่ระบบ</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (password !== String(f.get("confirm"))) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(/session/i.test(error.message) ? "ลิงก์หมดอายุ กรุณาขอลิงก์ใหม่" : thaiError(error.message));
    toast.success("ตั้งรหัสผ่านใหม่แล้ว");
    router.replace("/dashboard");
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">ตั้งรหัสผ่านใหม่</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="password" className="mb-1.5 block">รหัสผ่านใหม่</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <Label htmlFor="confirm" className="mb-1.5 block">ยืนยันรหัสผ่าน</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>
          {error && <p className="text-sm text-expense" role="alert">{error}</p>}
          <Button type="submit" loading={loading}>บันทึกรหัสผ่าน</Button>
        </form>
      </CardContent>
    </Card>
  );
}
