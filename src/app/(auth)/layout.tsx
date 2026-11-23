import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { supabaseEnv } from "@/lib/env";
import { SetupNotice } from "@/components/app/setup-notice";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm">{supabaseEnv().configured ? children : <SetupNotice />}</div>
    </main>
  );
}
