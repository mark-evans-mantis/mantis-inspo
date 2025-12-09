import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ============================================================
   Helper — Run OpenAI analysis on an image URL
   ============================================================ */
async function analyzeWithOpenAI(imageUrl: string) {
  const ANALYSIS_PROMPT = `
You are the creative director at Mantis...

[ SAME JSON PROMPT YOU PROVIDED — OMITTED HERE FOR LENGTH ]
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
            { type: "text", text: "Analyze this image and respond with JSON only." },
            { type: "image_url", image_url: { url: imageUrl } }
          ],
        },
      ],
    });

    // Extract usage
    const usage = completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    const promptTokens = usage.prompt_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? 0;

    // Pricing for gpt-4.1-mini
    const costUsd =
      (promptTokens * 0.40) / 1_000_000 +
      (outputTokens * 1.60) / 1_000_000;

    // Log exact usage to Postgres ledger
    await sql`
      INSERT INTO openai_usage_logs (
        model, input_tokens, output_tokens, total_tokens, cost_usd
      )
      VALUES (
        ${"gpt-4.1-mini"},
        ${promptTokens},
        ${outputTokens},
        ${totalTokens},
        ${costUsd}
      );
    `;

    // Parse JSON
    const text = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(text);

  } catch (err) {
    console.error("OpenAI analysis failed:", err);
    return {};
  }
}

/* ============================================================
   POST /api/upload
   ============================================================ */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const thumbFile = form.get("thumb") as File | null;   // for video
    const durationField = form.get("duration") as string | null;
    const project = (form.get("project") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const originalName = file.name || "upload";
    const arrayBuf = Buffer.from(await file.arrayBuffer());

    /* ------------------------------------------------------------
       1. Upload original media to Blob
       ------------------------------------------------------------ */
    const uniqueName = `${Date.now()}-${originalName}`;
    const blobUpload = await put(uniqueName, arrayBuf, {
      access: "public",
      contentType: mime,
    });

    /* ------------------------------------------------------------
       2. Thumbnail & duration (only for videos)
       ------------------------------------------------------------ */
    let thumbBlobUrl: string | null = null;
    let durationSeconds: number | null = null;

    if (thumbFile) {
      const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
      const thumbName = `${Date.now()}-thumb-${originalName.replace(/\.[^/.]+$/, "")}.jpg`;

      const thumbUpload = await put(thumbName, thumbBuffer, {
        access: "public",
        contentType: "image/jpeg",
      });

      thumbBlobUrl = thumbUpload.url;
    }

    if (durationField) {
      const n = Number(durationField);
      if (!Number.isNaN(n)) durationSeconds = n;
    }

    /* ------------------------------------------------------------
       3. Run OpenAI analysis
       ------------------------------------------------------------ */
    const isVideo = mime.startsWith("video/");
    const isImage = mime.startsWith("image/");

    let analysis: any = {};

    if (isImage && !isVideo) {
      analysis = await analyzeWithOpenAI(blobUpload.url);
    } else if (isVideo && thumbBlobUrl) {
      analysis = await analyzeWithOpenAI(thumbBlobUrl);
    } else {
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
    } = analysis;

    /* ------------------------------------------------------------
       4. Insert into Postgres
       ------------------------------------------------------------ */
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
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
