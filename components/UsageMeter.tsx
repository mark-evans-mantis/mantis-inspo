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
          budget_usd: Number(json.budget_usd ?? 0),
          remaining_usd: Number(json.remaining_usd ?? 0),
        });
      } catch (err) {
        console.error("Failed to load OpenAI usage:", err);
        setUsage({ spent_usd: 0, budget_usd: 0, remaining_usd: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const spent = usage?.spent_usd ?? 0;
  const budget = usage?.budget_usd ?? 0;
  const remaining = usage?.remaining_usd ?? 0;

  const pct =
    budget > 0 ? Math.min(100, Math.max(0, (remaining / budget) * 100)) : 0;

  let label: string;
  if (loading) {
    label = "Loading…";
  } else if (budget > 0) {
    label = `$${remaining.toFixed(2)} remaining / $${budget.toFixed(
      2
    )} (spent $${spent.toFixed(2)})`;
  } else {
    label = `Spent this month: $${spent.toFixed(2)}`;
  }

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">OpenAI usage</span>
        <div className="text-[11px] text-neutral-500">{label}</div>
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
