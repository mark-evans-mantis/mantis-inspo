import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    // If no API key, just return zeros instead of erroring
    if (!apiKey) {
      return NextResponse.json({
        remaining_usd: 0,
        total_granted_usd: 0,
        used_usd: 0,
      });
    }

    // Call OpenAI credit grants endpoint
    const res = await fetch(
      "https://api.openai.com/dashboard/billing/credit_grants",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      console.warn("OpenAI credit_grants failed:", res.status);
      return NextResponse.json({
        remaining_usd: 0,
        total_granted_usd: 0,
        used_usd: 0,
      });
    }

    const data = await res.json();

    // According to OpenAI, these are in USD, not cents
    const totalGranted = typeof data.total_granted === "number"
      ? data.total_granted
      : 0;
    const totalUsed = typeof data.total_used === "number"
      ? data.total_used
      : 0;
    const totalAvailable =
      typeof data.total_available === "number"
        ? data.total_available
        : Math.max(totalGranted - totalUsed, 0);

    return NextResponse.json({
      remaining_usd: totalAvailable,
      total_granted_usd: totalGranted,
      used_usd: totalUsed,
    });
  } catch (err) {
    console.error("openai-usage error:", err);
    return NextResponse.json({
      remaining_usd: 0,
      total_granted_usd: 0,
      used_usd: 0,
    });
  }
}
