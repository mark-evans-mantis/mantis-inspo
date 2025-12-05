import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const use_case = searchParams.get('use_case');
  const style_tag = searchParams.get('style_tag');

  const conditions = [];
  const params = [];

  if (q) {
    conditions.push(
      "(project ILIKE $1 OR notes ILIKE $1 OR original_name ILIKE $1 OR brand_refs::text ILIKE $1)"
    );
    params.push(`%${q}%`);
  }

  if (use_case) {
    conditions.push(`use_case = $${params.length + 1}`);
    params.push(use_case);
  }

  if (style_tag) {
    conditions.push(`style_tags::text ILIKE $${params.length + 1}`);
    params.push(`%${style_tag}%`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT *
    FROM inspo_images
    ${where}
    ORDER BY created_at DESC
  `;

  const { rows } = await sql.query(query, params);

  const mapped = rows.map((r) => ({
    id: r.id,
    blobUrl: r.blob_url,
    originalName: r.original_name,
    project: r.project,
    style_tags: r.style_tags || [],
    vibes: r.vibes || [],
    color_palette: r.color_palette || [],
    medium: r.medium,
    use_case: r.use_case,
    brand_refs: r.brand_refs || [],
    notes: r.notes,
    created_at: r.created_at,
  }));

  return NextResponse.json(mapped);
}
