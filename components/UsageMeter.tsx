"use client";

import { useMemo } from "react";

const used =
  Number(process.env.NEXT_PUBLIC_OPENAI_USAGE_USED_USD ?? "0") || 0;
const limit =
  Number(process.env.NEXT_PUBLIC_OPENAI_USAGE_LIMIT_USD ?? "50") || 50;

export default function UsageMeter() {
  const pct = useMemo(() => {
    if (limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }, []);

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">OpenAI usage</span>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span>${used.toFixed(2)} / ${limit.toFixed(0)}</span>
        </div>
      </div>
      <div className="flex w-32 items-center">
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-neutral-900 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
