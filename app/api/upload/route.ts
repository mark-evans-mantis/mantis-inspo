import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";
import OpenAI from "openai";

export const runtime = "nodejs"; // ok to keep, even though no FFmpeg now

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeWithOpenAI(imageUrl: string) {
  const ANALYSIS_PROMPT = `
You are the creative director at Mantis, a studio that creates high-end experiential
work (retail environments, installations, conference stages, pop-ups, and hybrid
digital/physical worlds).

Analyze the image you are given and respond ONLY in strict JSON. Do not include any explanation.

The JSON must have these fields:
- style_tags: array of 5–8 short style descriptors. Examples:
  "brutalist", "futuristic", "organic", "minimal", "maximalist", "techno-club",
  "gallery", "sci-fi", "retro-futurism", "modernist", "industrial".
- vibes: array of 3–6 emotional or atmospheric words
  (e.g. "intimate", "clinical", "euphoric", "kinetic", "serene", "chaotic", "luxurious", "playful").
- color_palette: array of 4–6 hex color strings for dominant colors (e.g. "#111111").
- medium: string, such as:
  "3D render", "architecture photo", "installation photo", "stage photo",
  "product shot", "graphic/poster", "UI/screen", or "misc".
- use_case: one of:
  "retail", "conference", "museum/gallery", "pop-up", "event entry", "stage",
  "activation zone", "XR/virtual", "architecture/space", "misc".
- brand_references: array of 0–6 brand names the image feels aligned with visually
  (e.g. "Apple", "A-COLD-WALL*", "Rimowa", "IKEA", "Prada").
- notes: 1–3 sentences in the voice of a creative director, describing how this
  image could inspire a Mantis installation or experience. Specific and practical.

Output ONLY valid JSON.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and respond with JSON only.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(text);
  } catch (err) {
    console.error("OpenAI analysis failed:", err);
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const thumbFile = form.get("thumb") as File | null;
    const durationField = form.get("duration") as string | null;
    const project = (form.get("project") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const originalName = file.name || "upload";
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Upload original file to Blob
    const uniqueName = `${Date.now()}-${originalName}`;
    const blobUpload = await put(uniqueName, buffer, {
      access: "public",
      contentType: mime,
    });

    let thumbBlobUrl: string | null = null;
    let durationSeconds: number | null = null;
    let analysis: any = {};

    const isVideo = mime.startsWith("video/");
    const isImage = mime.startsWith("image/");

    // 2. If client provided a thumbnail, upload it
    if (thumbFile) {
      const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
      const thumbName = `${Date.now()}-thumb-${originalName.replace(
        /\.[^/.]+$/,
        ""
      )}.jpg`;
      const thumbUpload = await put(thumbName, thumbBuffer, {
        access: "public",
        contentType: thumbFile.type || "image/jpeg",
      });
      thumbBlobUrl = thumbUpload.url;
    }

    if (durationField) {
      const n = Number(durationField);
      if (!Number.isNaN(n)) {
        durationSeconds = n;
      }
    }

    // 3. Decide what to send to OpenAI
    if (isImage && !isVideo) {
      // Images (including GIFs) → analyze original
      analysis = await analyzeWithOpenAI(blobUpload.url);
    } else if (isVideo && thumbBlobUrl) {
      // Videos → analyze thumbnail
      analysis = await analyzeWithOpenAI(thumbBlobUrl);
    } else {
      // Video with no thumbnail or unsupported media → no analysis
      analysis = {};
    }

    const {
      style_tags = [],
      vibes = [],
      color_palette = [],
      medium = isVideo ? "video" : null,
      use_case = null,
      brand_references = [],
      notes = null,
    } = analysis || {};

    // 4. Insert into Postgres
    const result = await sql`
      INSERT INTO inspo_images (
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
        notes
      )
      VALUES (
        ${blobUpload.url},
        ${thumbBlobUrl},
        ${originalName},
        ${project},
        ${mime},
        ${durationSeconds},
        ${JSON.stringify(style_tags)}::jsonb,
        ${JSON.stringify(vibes)}::jsonb,
        ${JSON.stringify(color_palette)}::jsonb,
        ${medium},
        ${use_case},
        ${JSON.stringify(brand_references)}::jsonb,
        ${notes}
      )
      RETURNING *;
    `;

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Error in POST /api/upload:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
