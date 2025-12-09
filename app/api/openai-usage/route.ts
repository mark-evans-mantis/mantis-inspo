import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const budgetEnv =
      process.env.OPENAI_BUDGET_USD ??
      process.env.NEXT_PUBLIC_OPENAI_BUDGET_USD ??
      "0";

    const budgetUsd = Number(budgetEnv) || 0;

    if (!apiKey) {
      return NextResponse.json({
        spent_usd: 0,
        budget_usd: budgetUsd,
        remaining_usd: budgetUsd,
      });
    }

    // Current month range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .split("T")[0];

    const url = `https://api.openai.com/v1/usage?start_date=${startDate}&end_date=${endDate}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      console.warn("OpenAI /v1/usage failed:", res.status);
      return NextResponse.json({
        spent_usd: 0,
        budget_usd: budgetUsd,
        remaining_usd: budgetUsd,
      });
    }

    const data = await res.json();

    // Some versions of /v1/usage return total_usage in cents,
    // plus per-day breakdown; handle both.
    let spentUsd = 0;

    if (typeof data.total_usage === "number") {
      spentUsd = data.total_usage / 100;
    } else if (Array.isArray(data.data)) {
      const totalCents = data.data.reduce(
        (sum: number, day: any) => sum + (day.total_usage ?? 0),
        0
      );
      spentUsd = totalCents / 100;
    }

    const remainingUsd =
      budgetUsd > 0 ? Math.max(budgetUsd - spentUsd, 0) : 0;

    return NextResponse.json({
      spent_usd: spentUsd,
      budget_usd: budgetUsd,
      remaining_usd: remainingUsd,
    });
  } catch (err) {
    console.error("openai-usage error:", err);
    const budgetEnv =
      process.env.OPENAI_BUDGET_USD ??
      process.env.NEXT_PUBLIC_OPENAI_BUDGET_USD ??
      "0";
    const budgetUsd = Number(budgetEnv) || 0;

    return NextResponse.json({
      spent_usd: 0,
      budget_usd: budgetUsd,
      remaining_usd: budgetUsd,
    });
  }
}
