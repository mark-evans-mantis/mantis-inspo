"use client";

import { useMemo } from "react";

/**
 * Simple static usage meter.
 *
 * You control the numbers via env vars:
 * - NEXT_PUBLIC_OPENAI_USAGE_USED_USD  (e.g. "12.34")
 * - NEXT_PUBLIC_OPENAI_USAGE_LIMIT_USD (e.g. "50")
 *
 * Set these in Vercel → Project → Settings → Environment Variables.
 * Then redeploy. This only visualizes what you set there.
 */

const usedUsd =
  Number(process.env.NEXT_PUBLIC_OPENAI_USAGE_USED_USD ?? "0") || 0;
const limitUsd =
  Number(process.env.NEXT_PUBLIC_OPENAI_USAGE_LIMIT_USD ?? "50") || 50;

export default function UsageMeter() {
  const pct = useMemo(() => {
    if (limitUsd <= 0) return 0;
    return Math.min(100, Math.round((usedUsd / limitUsd) * 100));
  }, []);

  const statusLabel =
    pct < 60 ? "Healthy" : pct < 90 ? "Getting high" : "Refill soon";

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">OpenAI usage</span>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span>
            ${usedUsd.toFixed(2)} / ${limitUsd.toFixed(0)}
          </span>
          <span className="h-[3px] w-px bg-neutral-300" />
          <span>{statusLabel}</span>
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
