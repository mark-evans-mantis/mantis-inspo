import { NextRequest, NextResponse } from "next/server";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
};

/* --------------------------------------------------------------------
   FETCH ROUTE
-------------------------------------------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    // 1) Try direct image first
    const direct = await tryDirectImageFetch(url);
    if (direct) return NextResponse.json(direct);

    // 2) Fetch HTML and extract all possible image URLs
    const html = await fetchHtml(url);
    if (!html) {
      return NextResponse.json(
        { error: "Failed to load HTML page" },
        { status: 400 }
      );
    }

    // 3) Extract images from HTML (img tags, meta tags, JSON, picture tags)
    const candidates = extractImageCandidates(html, url);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No images found in HTML" },
        { status: 400 }
      );
    }

    // 4) Attempt to download each candidate and select the best one
    for (const candidate of candidates) {
      const fetched = await tryDirectImageFetch(candidate);
      if (fetched) return NextResponse.json(fetched);
    }

    return NextResponse.json(
      { error: "Found images but could not download them" },
      { status: 400 }
    );
  } catch (err) {
    console.error("SCRAPER ERROR:", err);
    return NextResponse.json(
      { error: "Server error fetching image" },
      { status: 500 }
    );
  }
}

/* --------------------------------------------------------------------
   DIRECT IMAGE FETCH
-------------------------------------------------------------------- */
async function tryDirectImageFetch(url: string) {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuf = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");

    return { base64, contentType };
  } catch (err) {
    return null;
  }
}

/* --------------------------------------------------------------------
   FETCH HTML
-------------------------------------------------------------------- */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) return null;

    return await res.text();
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------
   UNIVERSAL IMAGE EXTRACTION
-------------------------------------------------------------------- */
function extractImageCandidates(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  /* ---------------- IMG TAGS ---------------- */
  const imgTagRegex = /<img[^>]+src=['"]([^'"]+)['"]/gi;
  let imgMatch;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    urls.add(resolveUrl(imgMatch[1], baseUrl));
  }

  /* ---------------- SRCSET ---------------- */
  const srcsetRegex = /srcset=['"]([^'"]+)['"]/gi;
  let srcsetMatch;
  while ((srcsetMatch = srcsetRegex.exec(html)) !== null) {
    const parts = srcsetMatch[1]
      .split(",")
      .map((p) => p.trim().split(" ")[0]);
    parts.forEach((p) => urls.add(resolveUrl(p, baseUrl)));
  }

  /* ---------------- OG:IMAGE META TAG ---------------- */
  const ogImgRegex =
    /<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/gi;
  let ogMatch;
  while ((ogMatch = ogImgRegex.exec(html)) !== null) {
    urls.add(resolveUrl(ogMatch[1], baseUrl));
  }

  /* ---------------- TWITTER IMAGE META TAG ---------------- */
  const twitterImgRegex =
    /<meta[^>]+name=['"]twitter:image['"][^>]+content=['"]([^'"]+)['"]/gi;
  let twMatch;
  while ((twMatch = twitterImgRegex.exec(html)) !== null) {
    urls.add(resolveUrl(twMatch[1], baseUrl));
  }

  /* ---------------- LINK rel="image_src" ---------------- */
  const linkImgRegex =
    /<link[^>]+rel=['"]image_src['"][^>]+href=['"]([^'"]+)['"]/gi;
  let linkMatch;
  while ((linkMatch = linkImgRegex.exec(html)) !== null) {
    urls.add(resolveUrl(linkMatch[1], baseUrl));
  }

  /* ---------------- JSON EMBED SCRAPING (Pinterest, Cosmos, IG) ---------------- */
  const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
    const content = scriptMatch[1];

    // Extract any JSON-based embedded URLs
    const urlRegex =
      /(https?:\/\/[^\s"'\\]+?\.(?:jpg|jpeg|png|gif|webp|avif))/gi;
    let u;
    while ((u = urlRegex.exec(content)) !== null) {
      urls.add(resolveUrl(u[1], baseUrl));
    }
  }

  return Array.from(urls);
}

/* --------------------------------------------------------------------
   RELATIVE URL HANDLING
-------------------------------------------------------------------- */
function resolveUrl(found: string, base: string): string {
  try {
    return new URL(found, base).toString();
  } catch {
    return found;
  }
}
