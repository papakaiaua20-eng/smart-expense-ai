export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className ?? ""}`} style={{ fontFamily: "var(--font-display)" }}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#2563EB" />
        <path d="M10 9h12v14l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" fill="#fff" />
        <path d="M13 13h6M13 16.5h6" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-lg">
        Smart Expense <span className="text-primary">AI</span>
      </span>
    </span>
  );
}
