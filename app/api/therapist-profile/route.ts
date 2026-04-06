import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Get the authenticated user from the Bearer token
async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET — fetch the therapist profile for the logged-in user
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Try to find by user_id first
  let { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // If not found, try to link by email (existing therapist)
  if (!therapist && user.email) {
    const { data: byEmail } = await supabaseAdmin
      .from("therapists")
      .select("*")
      .eq("email", user.email)
      .single();

    if (byEmail) {
      // Link the existing therapist to this user
      await supabaseAdmin
        .from("therapists")
        .update({ user_id: user.id })
        .eq("id", byEmail.id);
      therapist = { ...byEmail, user_id: user.id };
    }
  }

  return NextResponse.json({ ok: true, therapist: therapist ?? null, user_id: user.id, email: user.email });
}

// PATCH — update the therapist profile
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const allowed = [
    "full_name", "phone", "bio", "gender", "online",
    "therapist_types", "training_areas", "assessment_types",
    "regions", "cultural_prefs", "arrangements", "age_groups",
    "style_q1", "style_q2", "activity_level",
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  // Check if therapist exists for this user
  const { data: existing } = await supabaseAdmin
    .from("therapists")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    // Create new therapist record
    update.user_id = user.id;
    update.email = user.email;
    update.status = "pending";
    update.tier = "free";
    const { data, error } = await supabaseAdmin.from("therapists").insert(update).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, created: true });
  }

  // Update existing — keep status as pending if already pending, otherwise set to pending for review
  const { error } = await supabaseAdmin
    .from("therapists")
    .update(update)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: existing.id });
}
