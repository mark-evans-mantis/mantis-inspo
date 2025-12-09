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

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MantisInspo/1.0; +https://www.mantis.works)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${res.status}` },
        { status: 400 }
      );
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL is not an image" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString("base64");

    return NextResponse.json({ base64, contentType });
  } catch (err) {
    console.error("fetch-image error:", err);
    return NextResponse.json(
      { error: "Unexpected error fetching image" },
      { status: 500 }
    );
  }
}

