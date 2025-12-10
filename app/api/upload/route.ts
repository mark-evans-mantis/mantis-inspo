import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";

// Import same metadata scraper used by /api/fetch-image
import { scrapeMetadata } from "@/app/api/fetch-image/route";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Missing file." }, { status: 400 });
    }

    // Upload blob
    const blobRes = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    // Detect MIME type
    const mime = file.type || "";

    // ----------------------------
    // OPTIONAL: Extract video duration
    // ----------------------------
    let durationSeconds: number | null = null;

    if (mime.startsWith("video/")) {
      const arrayBuffer = await file.arrayBuffer();
      const videoBlob = new Blob([arrayBuffer], { type: mime });
      const videoUrl = URL.createObjectURL(videoBlob);

      durationSeconds = await new Promise((resolve) => {
        const video = document.createElement("video");
        video.src = videoUrl;
        video.addEventListener("loadedmetadata", () => {
          resolve(video.duration || null);
          URL.revokeObjectURL(videoUrl);
        });
      });
    }

    // ----------------------------
    // AUTO METADATA SCRAPING (same as import-link)
    // ----------------------------
    let scraped = { title: "", description: "", siteName: "" };

    try {
      scraped = await scrapeMetadata(blobRes.url);
    } catch (e) {
      console.warn("Metadata scrape failed:", e);
    }

    // Insert row with metadata fields populated
    const { rows } = await sql`
      INSERT INTO inspo_images (
        blob_url,
        original_name,
        mime_type,
        duration_seconds,
        project,
        medium,
        use_case,
        style_tags,
        vibes,
        color_palette,
        brand_refs,
        notes
      ) VALUES (
        ${blobRes.url},
        ${file.name},
        ${mime},
        ${durationSeconds},
        ${scraped.title || null},
        ${null},
        ${null},
        ${[]},
        ${[]},
        ${[]},
        ${[]},
        ${scraped.description || null}
      )
      RETURNING *;
    `;

    return NextResponse.json({ ok: true, image: rows[0] });
  } catch (err: any) {
    console.error("[UPLOAD ERROR]:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
