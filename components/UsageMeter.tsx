"use client";

import { useEffect, useState } from "react";

type UsageResponse = {
  remaining_usd: number;
  total_granted_usd: number;
  used_usd: number;
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
          remaining_usd: Number(json.remaining_usd ?? 0),
          total_granted_usd: Number(json.total_granted_usd ?? 0),
          used_usd: Number(json.used_usd ?? 0)
        });
      } catch (err) {
        console.error("Failed to load OpenAI usage:", err);
        setUsage({ remaining_usd: 0, total_granted_usd: 0, used_usd: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const remaining = usage?.remaining_usd ?? 0;
  const total = usage?.total_granted_usd ?? 0;

  const pct =
    total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;

  const label =
    total > 0
      ? `$${remaining.toFixed(2)} remaining / $${total.toFixed(2)}`
      : loading
      ? "Loading…"
      : "No credit data";

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
