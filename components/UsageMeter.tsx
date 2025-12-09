"use client";

import { useEffect, useState } from "react";

export default function UsageMeter() {
  const [usage, setUsage] = useState<number | null>(null);
  const monthlyBudget = 50; // Your chosen budget for visualization

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/openai-usage");
        const json = await res.json();
        setUsage(json.total_usage_usd ?? 0);
      } catch (err) {
        console.error("Failed to load usage", err);
      }
    }
    load();
  }, []);

  const pct = usage === null ? 0 : Math.min(100, (usage / monthlyBudget) * 100);

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">OpenAI usage</span>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          {usage === null ? (
            "Loading…"
          ) : (
            <>
              <span>${usage.toFixed(2)}</span>
              <span>/</span>
              <span>${monthlyBudget}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex w-24 items-center">
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
