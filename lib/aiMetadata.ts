import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

/**
 * Runs GPT-4.1 Vision to extract full structured metadata
 * for any uploaded image.
 */
export async function generateAIMetadata(imageUrl: string) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `
You analyze images and output metadata for a creative inspiration library.
Return ONLY a strict JSON object with these keys:

{
  "project": string | null,
  "medium": string | null,
  "use_case": string | null,
  "style_tags": string[],
  "vibes": string[],
  "color_palette": { "name": string, "hex": string }[],
  "brand_refs": string[],
  "notes": string | null
}

Rules:
- Keep all strings short and clean.
- Never invent exact hex values; infer approximate hex codes from colors.
- Do NOT mention GPT, AI, speculation, or analysis steps.
- If unsure, leave field null or empty array.
`
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extract structured metadata for this image." },
            {
              type: "image_url",
              image_url: imageUrl
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 800
    });

    const raw = response.choices[0].message?.content;
    if (!raw) {
      throw new Error("No metadata returned.");
    }

    // ensure valid JSON
    const parsed = JSON.parse(raw);

    return {
      project: parsed.project ?? null,
      medium: parsed.medium ?? null,
      use_case: parsed.use_case ?? null,
      style_tags: Array.isArray(parsed.style_tags) ? parsed.style_tags : [],
      vibes: Array.isArray(parsed.vibes) ? parsed.vibes : [],
      color_palette: Array.isArray(parsed.color_palette) ? parsed.color_palette : [],
      brand_refs: Array.isArray(parsed.brand_refs) ? parsed.brand_refs : [],
      notes: parsed.notes ?? null
    };
  } catch (err) {
    console.error("AI metadata error:", err);
    return {
      project: null,
      medium: null,
      use_case: null,
      style_tags: [],
      vibes: [],
      color_palette: [],
      brand_refs: [],
      notes: null
    };
  }
}
