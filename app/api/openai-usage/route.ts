import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    // OpenAI usage endpoint (current month)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .split("T")[0];

    const url = `https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch OpenAI usage" },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      // API returns cents — convert to dollars
      total_usage_usd: (data.total_usage ?? 0) / 100,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error fetching OpenAI usage" },
      { status: 500 }
    );
  }
}
