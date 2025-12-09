import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";
import OpenAI from "openai";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

export const runtime = "nodejs"; // Required for FFmpeg

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Very simple brightness heuristic if we ever inspect frames in detail
function isFrameBlack(pixels: Uint8Array, threshold = 18) {
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r > threshold || g > threshold || b > threshold) return false;
  }
  return true;
}

// Extract a thumbnail frame and duration from a video/GIF buffer
// NOTE: buffer is typed as any to satisfy fluent-ffmpeg's input types in TS.
async function extractThumbnail(buffer: any): Promise<{ thumb: Buffer; duration: number }> {
  return new Promise((resolve, reject) => {
    const frames: Buffer[] = [];
    let finalFrame: Buffer | null = null;
    let duration = 0;

    ffmpeg()
      .setFfmpegPath(ffmpegStatic as string)
      .input(buffer as any)
      .outputOptions([
        "-vf",
        "fps=3", // sample ~3 frames per second
        "-vframes",
        "50", // cap number of frames
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
      ])
      .on("codecData", (data) => {
        // duration like "00:00:03.45"
        const parts = data.duration.split(":").map(Number);
        if (parts.length === 3) {
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      })
      .on("error", (err) => {
        reject(err);
      })
      .on("end", () => {
        // crude: choose the first frame we captured
        if (frames.length > 0) {
          finalFrame = frames[0];
        }
        if (!finalFrame) {
          return reject("No usable frame found");
        }
        resolve({ thumb: finalFrame, duration });
      })
      .pipe()
      .on("data", (chunk: Buffer) => {
        frames.push(chunk);
      });
  });
}

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
  try {
    return JSON.parse(text);
  } catch {
    console.error("OpenAI returned non-JSON:", text);
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const project = (form.get("project") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mime = file.type;
    const originalName = file.name || "upload";
    const arrayBuf = Buffer.from(await file.arrayBuffer());

    // 1. Upload original file to Blob
    const uniqueName = `${Date.now()}-${originalName}`;
    const blobUpload = await put(uniqueName, arrayBuf, {
      access: "public",
      contentType: mime,
    });

    let thumbBlobUrl: string | null = null;
    let durationSeconds: number | null = null;
    let analysis: any = {};

    const isVideo = mime.startsWith("video/");
    const isGif = mime === "image/gif";

    if (isVideo || isGif) {
      // Extract thumbnail frame + duration
      const { thumb, duration } = await extractThumbnail(arrayBuf);
      durationSeconds = Math.round(duration);

      // Upload thumbnail
      const thumbName = `${Date.now()}-thumb-${originalName.replace(/\.[^/.]+$/, "")}.jpg`;
      const thumbUpload = await put(thumbName, thumb, {
        access: "public",
        contentType: "image/jpeg",
      });
      thumbBlobUrl = thumbUpload.url;

      // Analyze thumbnail with OpenAI
      analysis = await analyzeWithOpenAI(thumbBlobUrl);
    } else {
      // Direct image analysis
      analysis = await analyzeWithOpenAI(blobUpload.url);
    }

    const {
      style_tags = [],
      vibes = [],
      color_palette = [],
      medium = null,
      use_case = null,
      brand_references = [],
      notes = null,
    } = analysis || {};

    // 2. Save into Postgres
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
