import { NextRequest, NextResponse } from "next/server";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/*,video/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
};

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // 1) Try direct fetch first
    const direct = await tryDirectMediaFetch(url);
    if (direct) return NextResponse.json(direct);

    // 2) Otherwise scrape the page
    const html = await fetchHtml(url);
    if (!html) {
      return NextResponse.json({ error: "Failed to load HTML" }, { status: 400 });
    }

    const candidates = extractMediaCandidates(html, url);

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No media found on page" }, { status: 400 });
    }

    // 3) Try each candidate
    for (const candidate of candidates) {
      const fetched = await tryDirectMediaFetch(candidate);
      if (fetched) return NextResponse.json(fetched);
    }

    return NextResponse.json(
      { error: "Could not download media candidates" },
      { status: 400 }
    );
  } catch (err) {
    console.error("SCRAPER ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* -------------------------------------------------------
   DIRECT MEDIA FETCH (image or video)
------------------------------------------------------- */
async function tryDirectMediaFetch(url: string) {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") ?? "";

    // Accept all image & video formats
    if (
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      url.match(/\.(mp4|mov|webm|gif|jpg|jpeg|png|webp|avif)$/i)
    ) {
      const arrayBuf = Buffer.from(await res.arrayBuffer());
      const base64 = arrayBuf.toString("base64");

      return {
        base64,
        contentType,
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

/* -------------------------------------------------------
   FETCH HTML
------------------------------------------------------- */
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

/* -------------------------------------------------------
   EXTRACT MEDIA CANDIDATES FROM HTML
------------------------------------------------------- */
function extractMediaCandidates(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  const resolve = (src: string) => {
    try {
      return new URL(src, baseUrl).toString();
    } catch {
      return src;
    }
  };

  /* IMG tags */
  const imgRegex = /<img[^>]+src=['"]([^'"]+)['"]/gi;
  let m;
  while ((m = imgRegex.exec(html))) {
    urls.add(resolve(m[1]));
  }

  /* VIDEO tags */
  const videoRegex = /<video[^>]+src=['"]([^'"]+)['"]/gi;
  while ((m = videoRegex.exec(html))) {
    urls.add(resolve(m[1]));
  }

  /* VIDEO <source> tags */
  const srcRegex = /<source[^>]+src=['"]([^'"]+)['"]/gi;
  while ((m = srcRegex.exec(html))) {
    urls.add(resolve(m[1]));
  }

  /* og:image */
  const ogImgRegex = /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/gi;
  while ((m = ogImgRegex.exec(html))) {
    urls.add(resolve(m[1]));
  }

  /* og:video */
  const ogVidRegex = /property=['"]og:video['"][^>]*content=['"]([^'"]+)['"]/gi;
  while ((m = ogVidRegex.exec(html))) {
    urls.add(resolve(m[1]));
  }

  /* twitter:image */
  const twitterImgRegex = /name=['"]twitter:image['"][^>]*content=['"]([^'"]+)['"]/gi;
  while ((m = twitterImgRegex.exec(html))) {
    urls.add(resolve(m[1]));
  }

  /* JSON embedded media (Pinterest, IG, Cosmos) */
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let s;
  while ((s = scriptRegex.exec(html))) {
    const content = s[1];
    if (!content) continue;

    const urlRegex =
      /(https?:\/\/[^\s"'\\]+?\.(?:jpg|jpeg|png|gif|webp|mp4|mov|webm|m4v))/gi;
    let u;
    while ((u = urlRegex.exec(content))) {
      urls.add(resolve(u[1]));
    }
  }

  return Array.from(urls);
}
