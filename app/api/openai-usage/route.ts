import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        remaining_usd: 0,
        total_granted_usd: 0,
        used_usd: 0
      });
    }

    // Helper to safely fetch JSON
    const fetchJson = async (url: string) => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) return null;
      return res.json();
    };

    // 1) Try credit_grants (pre-purchased credits)
    const grants = await fetchJson(
      "https://api.openai.com/dashboard/billing/credit_grants"
    );

    let totalGranted = 0;
    let totalUsed = 0;
    let totalAvailable = 0;

    if (grants && typeof grants.total_granted === "number") {
      totalGranted = grants.total_granted ?? 0;
      totalUsed = grants.total_used ?? 0;
      totalAvailable =
        typeof grants.total_available === "number"
          ? grants.total_available
          : Math.max(totalGranted - totalUsed, 0);
    }

    // If we have real grant data, return it
    if (totalGranted > 0) {
      return NextResponse.json({
        remaining_usd: totalAvailable,
        total_granted_usd: totalGranted,
        used_usd: totalUsed
      });
    }

    // 2) Fallback: subscription + usage (pay-as-you-go / monthly cap)
    const sub = await fetchJson(
      "https://api.openai.com/dashboard/billing/subscription"
    );

    let hardLimit = 0;
    if (sub && typeof sub.hard_limit_usd === "number") {
      hardLimit = sub.hard_limit_usd;
    }

    // If still no limit info, just bail gracefully
    if (!hardLimit || hardLimit <= 0) {
      return NextResponse.json({
        remaining_usd: 0,
        total_granted_usd: 0,
        used_usd: 0
      });
    }

    // Get usage for THIS month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .split("T")[0];

    const usage = await fetchJson(
      `https://api.openai.com/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`
    );

    const centsUsed =
      usage && typeof usage.total_usage === "number"
        ? usage.total_usage
        : 0;
    const used = centsUsed / 100;
    const remaining = Math.max(hardLimit - used, 0);

    return NextResponse.json({
      remaining_usd: remaining,
      total_granted_usd: hardLimit,
      used_usd: used
    });
  } catch (err) {
    console.error("openai-usage error:", err);
    return NextResponse.json({
      remaining_usd: 0,
      total_granted_usd: 0,
      used_usd: 0
    });
  }
}
