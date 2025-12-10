import { NextResponse } from "next/server";

/**
 * Helper: extract metadata <meta property="og:*"> etc.
 */
function extractMeta(html: string, keys: string[]): string {
  for (const key of keys) {
    const propRegex = new RegExp(
      `<meta[^>]+property=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const propMatch = html.match(propRegex);
    if (propMatch?.[1]) return propMatch[1].trim();

    const nameRegex = new RegExp(
      `<meta[^>]+name=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const nameMatch = html.match(nameRegex);
    if (nameMatch?.[1]) return nameMatch[1].trim();
  }
  return "";
}

/**
 * Extract <title> fallback
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() ?? "";
}

/**
 * Main metadata scraping function.
 * This now works for COSMOS, PINTEREST, INSTAGRAM, ANY URL.
 */
async function scrapeMetadata(url: string) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL (${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";

  // If it's already an image → return directly
  if (contentType.startsWith("image/")) {
    return {
      imageUrl: url,
      title: "",
      description: "",
      siteName: "",
    };
  }

  // Otherwise parse HTML and extract metadata
  const html = await res.text();

  const title =
    extractMeta(html, ["og:title", "twitter:title"]) || extractTitle(html);

  const description =
    extractMeta(html, ["og:description", "twitter:description"]) || "";

  const imageUrl =
    extractMeta(html, [
      "og:image",
      "twitter:image",
      "pin:image", // Pinterest-specific
    ]) || "";

  const siteName = extractMeta(html, ["og:site_name"]) || "";

  return {
    title,
    description,
    imageUrl,
    siteName,
  };
}

/**
 * POST /api/fetch-image
 *
 * Body: { url: string }
 *
 * ALWAYS runs the metadata scrapers for ANY domain.
 * Fixes: Cosmos works, Pinterest works, ANY link works.
 */
export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { ok: false, error: "Missing URL." },
        { status: 400 }
      );
    }

    const metadata = await scrapeMetadata(url);

    return NextResponse.json({
      ok: true,
      asset: {
        sourceUrl: url,
        imageUrl: metadata.imageUrl || "",
        title: metadata.title || "",
        description: metadata.description || "",
        siteName: metadata.siteName || "",
      },
    });
  } catch (err: any) {
    console.error("[fetch-image] ERROR:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
