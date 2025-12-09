import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Ensure DB schema is up to date for images + videos + thumbnails
export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS inspo_images (
        id SERIAL PRIMARY KEY,
        blob_url TEXT NOT NULL,
        thumb_blob_url TEXT,
        original_name TEXT,
        project TEXT,
        mime_type TEXT,
        duration_seconds INT,
        style_tags JSONB,
        vibes JSONB,
        color_palette JSONB,
        medium TEXT,
        use_case TEXT,
        brand_refs JSONB,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Add columns if missing
    await sql`
      ALTER TABLE inspo_images 
      ADD COLUMN IF NOT EXISTS thumb_blob_url TEXT;
    `;

    await sql`
      ALTER TABLE inspo_images 
      ADD COLUMN IF NOT EXISTS mime_type TEXT;
    `;

    await sql`
      ALTER TABLE inspo_images 
      ADD COLUMN IF NOT EXISTS duration_seconds INT;
    `;

    return NextResponse.json({ ok: true, message: "Schema updated" });
  } catch (err) {
    console.error("DB init error:", err);
    return NextResponse.json({ error: "DB init failed" }, { status: 500 });
  }
}
