import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";

// Import shared metadata scraper from fetch-image
import { scrapeMetadata } from "@/app/api/fetch-image/route";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Missing file." },
        { status: 400 }
      );
    }

    // Upload file to Vercel Blob
    const blobRes = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    const mime = file.type || "";

    // Extract video duration for videos
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

    // Metadata scraping
    let scraped = { title: "", description: "", siteName: "" };

    try {
      scraped = await scrapeMetadata(blobRes.url);
    } catch (e) {
      console.warn("Metadata scrape failed:", e);
    }

    // Insert row into Postgres
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
        ${scraped.title || null},      -- project
        ${null},                       -- medium
        ${null},                       -- use_case
        ${'{}'},                       -- style_tags
        ${'{}'},                       -- vibes
        ${'{}'},                       -- color_palette
        ${'{}'},                       -- brand_refs
        ${scraped.description || null} -- notes
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

