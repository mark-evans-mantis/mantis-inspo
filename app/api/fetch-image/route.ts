import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid URL" },
        { status: 400 }
      );
    }

    // Full browser-like headers to bypass anti-bot blocks
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept:
        "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: url,
      Connection: "keep-alive",
    };

    const res = await fetch(url, {
      headers,
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${res.status}` },
        { status: 400 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL did not return an image; got: " + contentType },
        { status: 400 }
      );
    }

    // Convert to base64
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      base64,
      contentType,
    });
  } catch (err) {
    console.error("fetch-image error:", err);
    return NextResponse.json(
      { error: "Unexpected error fetching image" },
      { status: 500 }
    );
  }
}
