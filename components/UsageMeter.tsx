"use client";

import { useEffect, useState } from "react";

type UsageResponse = {
  spent_usd: number;
  budget_usd: number;
  remaining_usd: number;
};

export default function UsageMeter() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/openai-usage");
        const json = await res.json();

        setUsage({
          spent_usd: Number(json.spent_usd ?? 0),
          budget_usd: Number(json.budget_usd ?? 120),
          remaining_usd: Number(json.remaining_usd ?? 120),
        });

      } catch (err) {
        console.error("Failed to load usage:", err);
        setUsage({
          spent_usd: 0,
          budget_usd: 120,
          remaining_usd: 120,
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading || !usage) {
    return (
      <div className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-neutral-700">OpenAI usage</span>
          <div className="text-[11px] text-neutral-500">Loading…</div>
        </div>
        <div className="flex w-24 items-center">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-neutral-900 w-0" />
          </div>
        </div>
      </div>
    );
  }

  const spent = usage.spent_usd;
  const budget = usage.budget_usd;

  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur">

      {/* Left side label */}
      <div className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">OpenAI usage</span>

        <div className="text-[11px] text-neutral-500">
          <span>${spent.toFixed(6)}</span> used /{" "}
          <span>${budget.toFixed(2)}</span>
        </div>
      </div>

      {/* Right side progress bar */}
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
