import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { BottomNav, Sidebar } from "@/components/app/nav";
import { Logo } from "@/components/app/logo";
import { SetupNotice } from "@/components/app/setup-notice";
import { ThemeToggle } from "@/components/app/theme";
import { supabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnv().configured) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <SetupNotice />
      </main>
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh">
      <Sidebar email={user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/dashboard" aria-label="หน้าหลัก">
            <Logo className="[&_svg]:size-7 [&>span]:text-base" />
          </Link>
          <div className="flex items-center">
            <ThemeToggle />
            <Link href="/settings" className="rounded-lg p-2 text-muted hover:bg-slate-100" aria-label="ตั้งค่า">
              <Settings className="size-5" />
            </Link>
          </div>
        </header>
        <div className="hidden items-center justify-end gap-1 px-8 pt-4 lg:flex">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100">
              <LogOut className="size-4" /> ออกจากระบบ
            </button>
          </form>
        </div>
        <main className="pb-safe mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-5 lg:px-8 lg:pb-10 lg:pt-2">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
