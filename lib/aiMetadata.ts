import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

/**
 * Full AI metadata extraction using GPT-4.1 Vision (Responses API)
 */
export async function generateAIMetadata(imageUrl: string) {
  try {
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `
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
- Keep answers short and clean.
- If unsure, return null or empty array.
- Do NOT mention GPT or internal reasoning.
`
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract structured creative metadata for this image."
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "auto"
            }
          ]
        }
      ],
      max_output_tokens: 800,
      temperature: 0.2
    });

    const jsonText = response.output_text;
    const parsed = JSON.parse(jsonText);

    return {
      project: parsed.project ?? null,
      medium: parsed.medium ?? null,
      use_case: parsed.use_case ?? null,
      style_tags: parsed.style_tags ?? [],
      vibes: parsed.vibes ?? [],
      color_palette: parsed.color_palette ?? [],
      brand_refs: parsed.brand_refs ?? [],
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
