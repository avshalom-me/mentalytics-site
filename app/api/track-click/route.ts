import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const VALID_TYPES = ["whatsapp", "phone", "email"] as const;
type ClickType = (typeof VALID_TYPES)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { therapist_id, click_type } = body ?? {};

    if (!therapist_id || typeof therapist_id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing therapist_id" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(click_type as ClickType)) {
      return NextResponse.json({ ok: false, error: "Invalid click_type" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("therapist_contact_clicks")
      .insert({ therapist_id, click_type });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
