"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, ListOrdered, PiggyBank, ScanLine, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

export const NAV = [
  { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard },
  { href: "/transactions", label: "รายการ", icon: ListOrdered },
  { href: "/scan", label: "สแกนสลิป", icon: ScanLine },
  { href: "/budget", label: "งบประมาณ", icon: PiggyBank },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
];

function active(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

export function Sidebar({ email }: { email: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
      <Link href="/dashboard" className="px-3">
        <Logo />
      </Link>
      <nav className="mt-8 flex flex-col gap-1" aria-label="เมนูหลัก">
        {[...NAV, { href: "/settings", label: "ตั้งค่า", icon: Settings }].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(path, n.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-slate-50 hover:text-foreground",
              active(path, n.href) && "bg-blue-50 text-primary hover:bg-blue-50 hover:text-primary",
            )}
          >
            <n.icon className="size-5" aria-hidden />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto truncate px-3 text-xs text-muted" title={email}>
        {email}
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV.map((n) => {
          const isScan = n.href === "/scan";
          const on = active(path, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium text-muted",
                  on && "text-primary",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full",
                    isScan && "size-10 -mt-4 bg-primary text-white shadow-lg shadow-blue-600/30",
                  )}
                >
                  <n.icon className={isScan ? "size-5" : "size-5"} aria-hidden />
                </span>
                <span className="truncate">{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
