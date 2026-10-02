import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { TEACHER_FILES_BUCKET } from "@/app/lib/teachers.server";

// תמונת מורה: /teacher-photo/<id>. אותו דפוס כמו /therapist-photo - הבאקט
// פרטי, מוגש רק שדה התמונה (לעולם לא התעודה), ורק למורה שמוצג/ת בפומבי.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unavailable(): NextResponse {
  return new NextResponse("temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("not found", { status: 404 });
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("photo_path")
    .eq("id", id)
    .in("listing_state", ["trial", "paying", "pending", "archived"])
    .maybeSingle();
  if (error) return unavailable();
  if (!data?.photo_path) return new NextResponse("not found", { status: 404 });
  const { data: signed, error: signError } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).createSignedUrl(data.photo_path, 60);
  if (signError || !signed?.signedUrl) return unavailable();
  const upstream = await fetch(signed.signedUrl);
  if (upstream.status === 404) return new NextResponse("not found", { status: 404 });
  if (!upstream.ok || !upstream.body) return unavailable();
  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      // המורים אינם חלק מהאתר המאונדקס - גם לא התמונות שלהם.
      "X-Robots-Tag": "noindex",
    },
  });
}
