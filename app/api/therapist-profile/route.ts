import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendTherapistRegistrationReceivedEmail } from "@/app/lib/therapist-emails";

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
      .is("user_id", null)
      .maybeSingle();

    if (byEmail) {
      // Link the existing therapist to this user
      await supabaseAdmin
        .from("therapists")
        .update({ user_id: user.id })
        .eq("id", byEmail.id);
      therapist = { ...byEmail, user_id: user.id };
    }
  }

  // Generate signed photo URL if therapist has a profile photo
  let photoUrl: string | null = null;
  if (therapist?.profile_photo_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from("therapist-certificates")
      .createSignedUrl(therapist.profile_photo_path, 60 * 60 * 24);
    if (signed?.signedUrl) photoUrl = signed.signedUrl;
  }

  return NextResponse.json({ ok: true, therapist: therapist ?? null, photoUrl, user_id: user.id, email: user.email });
}

// PATCH — update the therapist profile
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const allowed = [
    "full_name", "phone", "bio", "gender", "online",
    "therapist_types", "training_areas", "assessment_types",
    "couples_modalities", "cogfun_age_groups",
    "regions", "cultural_prefs", "arrangements", "age_groups", "languages",
    "style_q1", "style_q2", "activity_level",
    "education", "experience",
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  // Stamp therapist-initiated edits so the admin can see the profile changed.
  update.profile_updated_at = new Date().toISOString();

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

    // Confirm receipt + set the "awaiting review" expectation. Best-effort —
    // a mail failure must never fail the profile creation.
    if (user.email) {
      try {
        await sendTherapistRegistrationReceivedEmail({
          to: user.email,
          name: typeof body.full_name === "string" ? body.full_name : "",
        });
      } catch (e) {
        console.error("therapist-profile: registration-received email failed:", e);
      }
    }

    return NextResponse.json({ ok: true, id: data.id, created: true });
  }

  // A rejected therapist who edits is re-submitting for review — send it back
  // to pending and clear the previous rejection reason. Approved/paying
  // profiles keep their status when edited.
  if (existing.status === "rejected") {
    update.status = "pending";
    update.rejection_reason = null;
  }

  const { error } = await supabaseAdmin
    .from("therapists")
    .update(update)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: existing.id });
}
