import { cn } from "@/lib/utils";

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-slate-100", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color ?? "var(--primary)" }} />
    </div>
  );
}
