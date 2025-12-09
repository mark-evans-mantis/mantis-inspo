import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { del } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // Next 16 expects params as a Promise
  const numericId = Number(id);

  if (!numericId) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    // Load row from DB
    const { rows } = await sql`
      SELECT blob_url, thumb_blob_url
      FROM inspo_images
      WHERE id = ${numericId};
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { blob_url, thumb_blob_url } = rows[0];

    // Delete blobs (ignore failures but log them)
    try {
      if (blob_url) {
        await del(blob_url);
      }
    } catch (err) {
      console.warn("Failed to delete blob_url:", err);
    }

    try {
      if (thumb_blob_url) {
        await del(thumb_blob_url);
      }
    } catch (err) {
      console.warn("Failed to delete thumb_blob_url:", err);
    }

    // Delete DB row
    await sql`
      DELETE FROM inspo_images
      WHERE id = ${numericId};
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/images/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
