import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Auth is enforced by middleware (Basic Auth on /api/admin-*).

// Search Unsplash for candidate article images. The admin types a query
// (usually the article topic/title) and picks one of the results. Degrades
// gracefully: with no UNSPLASH_ACCESS_KEY configured, returns configured:false
// so the UI falls back to pasting an image URL by hand.

type UnsplashPhoto = {
  urls: { regular: string; small: string };
  alt_description: string | null;
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

export async function GET(req: NextRequest) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json({ ok: true, configured: false, results: [] });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ ok: true, configured: true, results: [] });
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "9");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Unsplash error ${res.status}` },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { results: UnsplashPhoto[] };
    // Build a cropped, sized URL matching the look of the existing /research
    // cards (600×260, cover). The download_location is required by Unsplash's
    // API guidelines and is triggered server-side when an image is chosen.
    const results = (json.results ?? []).map((p) => ({
      thumb: p.urls.small,
      url: `${p.urls.regular}&w=1200&h=520&fit=crop&auto=format&q=75`,
      alt: p.alt_description ?? "",
      credit: p.user.name,
      credit_url: p.user.links.html,
      download_location: p.links.download_location,
    }));
    return NextResponse.json({ ok: true, configured: true, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 }
    );
  }
}
