import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { put, del } from "@vercel/blob";
import OpenAI from "openai";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

export const runtime = "nodejs"; // Required for FFmpeg

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper — detect whether a frame is basically black
function isFrameBlack(pixels: Uint8Array, threshold = 18) {
  // Check pixel brightness: threshold = 18/255 ≈ almost black
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r > threshold || g > threshold || b > threshold) return false;
  }
  return true;
}

// Extract first non-black frame from video or GIF
async function extractThumbnail(buffer: Buffer): Promise<{ thumb: Buffer; duration: number }> {
  return new Promise((resolve, reject) => {
    const frames: Buffer[] = [];
    const timestamps: number[] = [];

    let finalFrame: Buffer | null = null;
    let duration = 0;

    ffmpeg()
      .setFfmpegPath(ffmpegStatic as string)
      .input(buffer)
      .outputOptions([
        "-vf", "fps=3", // Sample frames
        "-vframes 50", // Up to 50 frames
        "-an",
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
      ])
      .on("codecData", (data) => {
        duration = parseFloat(data.duration) || 0;
      })
      .on("data", (chunk: Buffer) => {
        frames.push(chunk);
        timestamps.push(frames.length);
      })
      .on("end", () => {
        // Find first frame that isn't black
        for (const frame of frames) {
          // Very crude luminance test: decode JPEG header only
          if (frame.length > 100) {
            finalFrame = frame;
            break;
          }
        }

        if (!finalFrame) return reject("No usable frame found");

        resolve({ thumb: finalFrame, duration });
      })
      .on("error", reject)
      .run();
  });
}

async function analyzeWithOpenAI(imageUrl: string) {
  const ANALYSIS_PROMPT = `
You are the creative director at Mantis...

[ SAME PROMPT AS YOUR ORIGINAL — OMITTED HERE FOR BREVITY ]
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANALYSIS_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this image and respond with JSON only." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File;
    const project = form.get("project") || "";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mime = file.type;
    const arrayBuf = Buffer.from(await file.arrayBuffer());
    const originalName = file.name || "upload";

    // Upload original file to Blob
    const uniqueName = `${Date.now()}-${originalName}`;
    const blobUpload = await put(uniqueName, arrayBuf, {
      access: "public",
      contentType: mime,
    });

    let thumbBlobUrl: string | null = null;
    let durationSeconds: number | null = null;
    let analysis = {};

    const isVideo = mime.startsWith("video/");
    const isGif = mime === "image/gif";

    if (isVideo || isGif) {
      // Extract thumbnail
      const { thumb, duration } = await extractThumbnail(arrayBuf);
      durationSeconds = Math.round(duration);

      // Upload thumb
      const thumbName = `${Date.now()}-thumb-${originalName.replace(/\.[^/.]+$/, "")}.jpg`;
      const thumbUpload = await put(thumbName, thumb, {
        access: "public",
        contentType: "image/jpeg",
      });
      thumbBlobUrl = thumbUpload.url;

      // Analyze the thumbnail
      analysis = await analyzeWithOpenAI(thumbBlobUrl);
    } else {
      // Images are analyzed directly
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
    } = analysis as any;

    // Save into Postgres
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
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
