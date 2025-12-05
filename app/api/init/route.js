import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  await sql`
    CREATE TABLE IF NOT EXISTS inspo_images (
      id SERIAL PRIMARY KEY,
      blob_url TEXT NOT NULL,
      original_name TEXT,
      project TEXT,
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
  return NextResponse.json({ ok: true });
}
