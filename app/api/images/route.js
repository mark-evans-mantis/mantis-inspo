import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { rows } = await sql`
      SELECT
        id,
        blob_url,
        thumb_blob_url,
        original_name,
        project,
        mime_type,
        duration_seconds,
        style_tags,
        vibes,
        color_palette,
        medium,
        use_case,
        brand_refs,
        notes,
        created_at
      FROM inspo_images
      ORDER BY created_at DESC;
    `;

    // Normalize result for frontend
    const mapped = rows.map((r) => ({
      id: r.id,
      blobUrl: r.blob_url,
      thumbBlobUrl: r.thumb_blob_url,
      originalName: r.original_name,
      project: r.project,
      mimeType: r.mime_type,
      durationSeconds: r.duration_seconds,
      style_tags: r.style_tags ?? [],
      vibes: r.vibes ?? [],
      color_palette: r.color_palette ?? [],
      medium: r.medium,
      use_case: r.use_case,
      brand_refs: r.brand_refs ?? [],
      notes: r.notes,
      created_at: r.created_at,
      isVideo: r.mime_type?.startsWith("video/") || false,
      isGif: r.mime_type === "image/gif",
    }));

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("GET /api/images error:", err);
    return NextResponse.json(
      { error: "Failed to load images" },
      { status: 500 }
    );
  }
}
