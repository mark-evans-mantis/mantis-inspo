import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    // If no API key, just return zero instead of erroring
    if (!apiKey) {
      return NextResponse.json({ total_usage_usd: 0 });
    }

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .split("T")[0];

    const url = `https://api.openai.com/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      console.warn("OpenAI usage fetch failed:", res.status);
      return NextResponse.json({ total_usage_usd: 0 });
    }

    const data = await res.json();
    const cents =
      typeof data.total_usage === "number" ? data.total_usage : 0;

    return NextResponse.json({ total_usage_usd: cents / 100 });
  } catch (err) {
    console.error("openai-usage error:", err);
    return NextResponse.json({ total_usage_usd: 0 });
  }
}
