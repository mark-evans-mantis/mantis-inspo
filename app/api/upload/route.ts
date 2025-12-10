import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";
import { generateAIMetadata } from "@/lib/aiMetadata";

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

    // Upload file to Blob
    const blobRes = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: "public"
    });

    const mime = file.type || "";

    // Extract video duration
    let durationSeconds: number | null = null;
    if (mime.startsWith("video/")) {
      const buf = await file.arrayBuffer();
      const videoBlob = new Blob([buf], { type: mime });
      const url = URL.createObjectURL(videoBlob);

      durationSeconds = await new Promise((resolve) => {
        const v = document.createElement("video");
        v.src = url;
        v.addEventListener("loadedmetadata", () => {
          resolve(v.duration || null);
          URL.revokeObjectURL(url);
        });
      });
    }

    // RUN AI METADATA (GPT-4.1 Vision)
    const metadata = await generateAIMetadata(blobRes.url);

    // Insert into Postgres
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
      )
      VALUES (
        ${blobRes.url},
        ${file.name},
        ${mime},
        ${durationSeconds},
        ${metadata.project},
        ${metadata.medium},
        ${metadata.use_case},
        ${JSON.stringify(metadata.style_tags)},
        ${JSON.stringify(metadata.vibes)},
        ${JSON.stringify(metadata.color_palette)},
        ${JSON.stringify(metadata.brand_refs)},
        ${metadata.notes}
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
