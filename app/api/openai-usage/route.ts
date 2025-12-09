import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Start of current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const startIso = startDate.toISOString(); // Convert Date → string for SQL

    // Sum exact cost from our ledger table
    const { rows } = await sql`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric AS spent
      FROM openai_usage_logs
      WHERE created_at >= ${startIso};
    `;

    // Precise USD spent (can be fractional cents)
    const spent = Number(rows[0].spent) || 0;

    // Your fixed monthly budget
    const budget = 120;
    const remaining = Math.max(budget - spent, 0);

    return NextResponse.json({
      spent_usd: spent,
      budget_usd: budget,
      remaining_usd: remaining,
    });
  } catch (err) {
    console.error("openai-usage error:", err);
    return NextResponse.json({
      spent_usd: 0,
      budget_usd: 120,
      remaining_usd: 120,
    });
  }
}
