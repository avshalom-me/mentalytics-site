import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendTherapistRegistrationReceivedEmail } from "@/app/lib/therapist-emails";
import { findClaimableTherapistByEmail } from "@/app/lib/therapist-claim";
import { ATTRIBUTION_HEADER, sanitizeAttribution, sanitizeClickIds } from "@/app/lib/attribution";
import { THERAPIST_EDIT_FIELDS } from "@/app/lib/therapist-fields";

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

// Signup attribution: which campaign / channel drove this registration.
// The dashboard sends the client-captured touch as a URI-encoded JSON header
// (the stub row is created by a GET, which has no body). Consumed only at
// stub creation — an existing profile is never overwritten. Feeds the
// signups-per-campaign columns in /admin/recruitment.
function signupAttributionFromHeader(req: NextRequest): Record<string, string | null> {
  const raw = req.headers.get(ATTRIBUTION_HEADER);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    const att = sanitizeAttribution(parsed);
    const clicks = sanitizeClickIds(parsed);
    return {
      signup_channel: att.channel,
      signup_utm_source: att.utm_source,
      signup_utm_medium: att.utm_medium,
      signup_utm_campaign: att.utm_campaign,
      signup_gclid: clicks.gclid,
      signup_gbraid: clicks.gbraid,
      signup_wbraid: clicks.wbraid,
      signup_fbclid: clicks.fbclid,
    };
  } catch {
    return {}; // malformed header — register without attribution
  }
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

  // If not found, try to link an admin-pre-added row by email. Only
  // not-yet-live rows are eligible — see findClaimableTherapistByEmail.
  if (!therapist && user.email) {
    const byEmail = await findClaimableTherapistByEmail(user.email, "*");
    if (byEmail) {
      // Link the existing therapist to this user
      await supabaseAdmin
        .from("therapists")
        .update({ user_id: user.id })
        .eq("id", byEmail.id as string);
      therapist = { ...byEmail, user_id: user.id };
    }
  }

  // Still nothing — a freshly registered account. Create a stub row NOW so
  // every registrant is visible in the admin from the moment they sign up
  // (before this, whoever abandoned the profile form simply didn't exist for
  // the admin). The first real save (PATCH with a name) upgrades the stub.
  if (!therapist) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("therapists")
      .insert({
        user_id: user.id, email: user.email, full_name: "", gender: "",
        status: "pending", tier: "free",
        ...signupAttributionFromHeader(req),
      })
      .select("*")
      .single();
    if (createErr) {
      // Unique-violation → a concurrent request created it first; re-read.
      const { data: raced } = await supabaseAdmin
        .from("therapists")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      therapist = raced ?? null;
    } else {
      therapist = created;
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

  // Existing certificates, so the edit page can show the therapist what they
  // already uploaded (otherwise the field looks empty and they can't tell).
  let certificates: Array<{ id: string; original_name: string; signed_url: string | null }> = [];
  if (therapist?.id) {
    const { data: certRows } = await supabaseAdmin
      .from("therapist_certificates")
      .select("id, file_path, original_name, created_at")
      .eq("therapist_id", therapist.id)
      .order("created_at", { ascending: true });
    certificates = await Promise.all(
      (certRows ?? []).map(async (c) => {
        let signed_url: string | null = null;
        const { data: signed } = await supabaseAdmin.storage
          .from("therapist-certificates")
          .createSignedUrl(c.file_path, 60 * 60 * 24);
        if (signed?.signedUrl) signed_url = signed.signedUrl;
        return { id: c.id, original_name: c.original_name ?? "תעודה", signed_url };
      })
    );
  }

  return NextResponse.json({ ok: true, therapist: therapist ?? null, photoUrl, certificates, user_id: user.id, email: user.email });
}

// PATCH — update the therapist profile
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const update: Record<string, unknown> = {};
  for (const key of THERAPIST_EDIT_FIELDS) {
    if (key in body) update[key] = body[key];
  }
  // Stamp therapist-initiated edits so the admin can see the profile changed.
  update.profile_updated_at = new Date().toISOString();

  // Check if therapist exists for this user
  const { data: existing } = await supabaseAdmin
    .from("therapists")
    .select("id, status, full_name")
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

  // A stub row (auto-created at first login, no name yet) getting its first
  // real save IS the registration — behave exactly like the insert path:
  // send the registration-received email and let the client show the
  // plan-choice screen (created: true).
  const wasStub = !(existing.full_name ?? "").trim();
  const isFirstRealSave = wasStub && typeof update.full_name === "string" && update.full_name.trim() !== "";

  const { error } = await supabaseAdmin
    .from("therapists")
    .update(update)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (isFirstRealSave && user.email) {
    try {
      await sendTherapistRegistrationReceivedEmail({
        to: user.email,
        name: typeof body.full_name === "string" ? body.full_name : "",
      });
    } catch (e) {
      console.error("therapist-profile: registration-received email failed:", e);
    }
  }

  return NextResponse.json({ ok: true, id: existing.id, created: isFirstRealSave });
}
