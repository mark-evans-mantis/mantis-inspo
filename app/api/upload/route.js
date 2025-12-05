import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { sql } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('image');
    const project = formData.get('project') || null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    const originalName = file.name || 'upload';

    // 1) Upload file to Vercel Blob
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put(originalName, buffer, {
      access: 'public',
      contentType: file.type || 'image/jpeg',
    });

    // 2) Analyze with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and respond with JSON only.',
            },
            {
              type: 'image_url',
              image_url: { url: blob.url },
            },
          ],
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      console.error('OpenAI JSON parse error:', content);
      return NextResponse.json(
        { error: 'OpenAI returned invalid JSON' },
        { status: 500 }
      );
    }

    const style_tags = data.style_tags ?? [];
    const vibes = data.vibes ?? [];
    const color_palette = data.color_palette ?? [];
    const medium = data.medium ?? null;
    const use_case = data.use_case ?? null;
    const brand_refs = data.brand_references ?? [];
    const notes = data.notes ?? null;

    // 3) Save to Postgres
    const result = await sql`
      INSERT INTO inspo_images (
        blob_url, original_name, project,
        style_tags, vibes, color_palette,
        medium, use_case, brand_refs, notes
      )
      VALUES (
        ${blob.url},
        ${originalName},
        ${project},
        ${JSON.stringify(style_tags)}::jsonb,
        ${JSON.stringify(vibes)}::jsonb,
        ${JSON.stringify(color_palette)}::jsonb,
        ${medium},
        ${use_case},
        ${JSON.stringify(brand_refs)}::jsonb,
        ${notes}
      )
      RETURNING *
    `;

    const r = result.rows[0];

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error('Error in POST /api/upload', err);
    return NextResponse.json(
      { error: 'Failed to upload or analyze image' },
      { status: 500 }
    );
  }
}
