"use client";
import { NativeSelect, Input } from "@/components/ui/input";
import { RANGE_LABELS, type RangePreset } from "@/lib/dates";

export type RangeValue = { preset: RangePreset; from: string; to: string };

export function rangeQuery(r: RangeValue) {
  const p = new URLSearchParams({ range: r.preset });
  if (r.preset === "custom") {
    if (r.from) p.set("from", r.from);
    if (r.to) p.set("to", r.to);
  }
  return p.toString();
}

export function RangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="ช่วงเวลา"
        className="h-10 w-auto"
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as RangePreset })}
      >
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((k) => (
          <option key={k} value={k}>
            {RANGE_LABELS[k]}
          </option>
        ))}
      </NativeSelect>
      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="ตั้งแต่วันที่" className="h-10 w-[9.5rem]" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-muted">–</span>
          <Input type="date" aria-label="ถึงวันที่" className="h-10 w-[9.5rem]" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
