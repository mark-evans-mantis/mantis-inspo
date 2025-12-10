import { NextRequest, NextResponse } from "next/server";

/**
 * Shared metadata scraper.
 * Works for both import-link and uploads.
 */
export async function scrapeMetadata(url: string) {
  try {
    const res = await fetch(url, { method: "GET" });

    // Fallback if URL is an image or non-HTML
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return {
        title: "",
        description: "",
        siteName: "",
      };
    }

    const html = await res.text();

    // Extract <meta> tags
    const title =
      matchMeta(html, "property", "og:title") ||
      matchMeta(html, "name", "title") ||
      "";

    const description =
      matchMeta(html, "property", "og:description") ||
      matchMeta(html, "name", "description") ||
      "";

    const siteName =
      matchMeta(html, "property", "og:site_name") ||
      "";

    return {
      title,
      description,
      siteName,
    };
  } catch (err) {
    console.warn("scrapeMetadata error:", err);
    return {
      title: "",
      description: "",
      siteName: "",
    };
  }
}

// Small helper to read meta tags
function matchMeta(html: string, attr: string, value: string) {
  const regex = new RegExp(
    `<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * Default API route — this runs when frontend calls /api/fetch-image
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const metadata = await scrapeMetadata(url);
    return NextResponse.json({ ok: true, metadata });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
