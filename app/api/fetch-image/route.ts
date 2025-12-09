import { NextRequest, NextResponse } from "next/server";

// Browser-like headers for anti-bot protection
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json(
        { error: "URL missing" },
        { status: 400 }
      );
    }

    // STEP 1 — ATTEMPT DIRECT IMAGE FETCH FIRST
    const directAttempt = await tryDirectImageFetch(url);
    if (directAttempt) {
      return NextResponse.json(directAttempt);
    }

    // STEP 2 — OTHERWISE SCRAPE PAGE HTML FOR IMAGES
    const imageUrl = await extractImageFromPage(url);
    if (!imageUrl) {
      return NextResponse.json(
        { error: "No images found on page" },
        { status: 400 }
      );
    }

    // STEP 3 — FETCH THE FOUND IMAGE
    const imageData = await fetchImageAsBase64(imageUrl);
    if (!imageData) {
      return NextResponse.json(
        { error: "Image found but could not be downloaded" },
        { status: 400 }
      );
    }

    return NextResponse.json(imageData);
  } catch (err) {
    console.error("FETCH IMAGE ERROR:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------
   ATTEMPT 1: DIRECT IMAGE FETCH
------------------------------------------------------- */
async function tryDirectImageFetch(url: string) {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return null; // Not a direct image
    }

    const arrayBuf = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");

    return {
      base64,
      contentType,
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------
   ATTEMPT 2: SCRAPE PAGE FOR IMAGES
------------------------------------------------------- */
async function extractImageFromPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const html = await res.text();

    // Extract <img> tags
    const imgRegex = /<img[^>]+src=['"]([^'"]+)['"]/gi;
    const urls: string[] = [];

    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(resolveUrl(match[1], url));
    }

    if (urls.length === 0) return null;

    // Prefer the first or largest images
    return urls[0];
  } catch (err) {
    console.error("SCRAPING ERROR:", err);
    return null;
  }
}

// Handle relative URLs (e.g. /img/foo.jpg)
function resolveUrl(foundUrl: string, pageUrl: string): string {
  try {
    return new URL(foundUrl, pageUrl).toString();
  } catch {
    return foundUrl;
  }
}

/* -------------------------------------------------------
   FETCH IMAGE AS BASE64
------------------------------------------------------- */
async function fetchImageAsBase64(imageUrl: string) {
  try {
    const res = await fetch(imageUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuf = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");

    return { base64, contentType };
  } catch (err) {
    console.error("FETCH AS BASE64 ERROR:", err);
    return null;
  }
}
