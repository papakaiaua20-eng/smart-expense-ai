"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "theme";

/** Runs before first paint (in <head>) so the page never flashes the wrong theme. */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function apply(t: ThemeChoice) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: still apply for this visit */
  }
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  window.dispatchEvent(new Event("themechange"));
}

export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [t, setT] = useState<ThemeChoice>("system");
  useEffect(() => {
    setT(read());
    const on = () => setT(read());
    window.addEventListener("themechange", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("themechange", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return [t, (n) => { apply(n); setT(n); }];
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "สว่าง", icon: Sun },
  { value: "dark", label: "มืด", icon: Moon },
  { value: "system", label: "ตามเครื่อง", icon: Monitor },
];

/** Compact icon button that cycles สว่าง → มืด → ตามเครื่อง. */
export function ThemeToggle({ className }: { className?: string }) {
  const [t, set] = useTheme();
  const i = OPTIONS.findIndex((o) => o.value === t);
  const cur = OPTIONS[i];
  const next = OPTIONS[(i + 1) % OPTIONS.length];
  return (
    <button
      type="button"
      onClick={() => set(next.value)}
      className={cn("rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-foreground", className)}
      aria-label={`ธีม: ${cur.label} (แตะเพื่อเปลี่ยนเป็น${next.label})`}
      title={`ธีม: ${cur.label}`}
    >
      <cur.icon className="size-5" />
    </button>
  );
}

/** Three-way segmented control for the settings page. */
export function ThemeSelect() {
  const [t, set] = useTheme();
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="ธีมสี">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={t === o.value}
          onClick={() => set(o.value)}
          className={cn(
            "flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted",
            t === o.value && "bg-surface text-foreground shadow-sm",
          )}
        >
          <o.icon className="size-4" /> {o.label}
        </button>
      ))}
    </div>
  );
}
