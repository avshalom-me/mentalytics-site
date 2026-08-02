import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendTherapistRegistrationReceivedEmail } from "@/app/lib/therapist-emails";
import { findClaimableTherapistByEmail } from "@/app/lib/therapist-claim";
import { ATTRIBUTION_HEADER, sanitizeAttribution, sanitizeClickIds } from "@/app/lib/attribution";
import { THERAPIST_EDIT_FIELDS } from "@/app/lib/therapist-fields";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "@/app/lib/consent";

export const dynamic = "force-dynamic";

// Marketing-consent captured at registration lives on the auth user's metadata
// (set by supabase.auth.signUp on the login page). Apply it to the therapist row
// the first time we see it, and write an immutable consent_events audit row.
// Idempotent: no-op once the row already reflects consent, so it never
// double-records or touches therapists who registered before this existed.
async function applySignupConsent(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  therapist: Record<string, unknown> | null,
  req: NextRequest,
): Promise<Record<string, unknown> | null> {
  if (!therapist?.id) return therapist;
  const wantsConsent = user.user_metadata?.newsletter_consent === true;
  if (!wantsConsent || therapist.newsletter_consent === true) return therapist;

  // Grant only ONCE, ever. newsletter_consent defaults to false (not null), so we
  // can't tell "never decided" from "withdrew" by the flag alone — check the audit
  // trail. If any newsletter consent decision was already recorded (granted or
  // later withdrawn via the unsubscribe link), don't re-grant: otherwise a
  // dashboard reload would silently undo an unsubscribe (the metadata stays true).
  const { data: prior } = await supabaseAdmin
    .from("consent_events")
    .select("id")
    .eq("therapist_id", therapist.id as string)
    .eq("consent_type", "newsletter")
    .limit(1)
    .maybeSingle();
  if (prior) return therapist;

  const { error: updErr } = await supabaseAdmin
    .from("therapists")
    .update({ newsletter_consent: true })
    .eq("id", therapist.id as string);
  if (updErr) {
    console.error("applySignupConsent: flag update failed:", updErr.message);
    return therapist; // don't audit a grant we didn't persist
  }

  const version =
    typeof user.user_metadata?.newsletter_consent_version === "string"
      ? (user.user_metadata!.newsletter_consent_version as string)
      : NEWSLETTER_CONSENT_VERSION;
  const { error: auditErr } = await supabaseAdmin.from("consent_events").insert({
    therapist_id: therapist.id,
    email: user.email ?? "",
    consent_type: "newsletter",
    action: "granted",
    consent_text: NEWSLETTER_CONSENT_TEXT,
    consent_version: version,
    source: "signup",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
    user_agent: req.headers.get("user-agent") || null,
  });
  if (auditErr) console.error("applySignupConsent: audit insert failed:", auditErr.message);

  return { ...therapist, newsletter_consent: true };
}

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

  // Apply a registration-time marketing-consent opt-in (from auth metadata) the
  // first time we resolve this therapist. Idempotent; existing therapists who
  // never opted in are untouched.
  therapist = await applySignupConsent(user, therapist, req);

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

  // publication_links is therapist-supplied and rendered as real anchors on a
  // public page, so it is sanitised here rather than trusted: http/https only
  // (blocks javascript: and data:), blanks dropped, deduped, and capped at the
  // same 10 the DB constraint enforces. A bad URL should silently not be saved
  // rather than 500 on the constraint.
  if ("publication_links" in update) {
    const raw = Array.isArray(update.publication_links) ? update.publication_links : [];
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        continue;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (seen.has(parsed.href)) continue;
      seen.add(parsed.href);
      clean.push(parsed.href);
      if (clean.length >= 10) break;
    }
    update.publication_links = clean;
  }

  if ("license_number" in update) {
    const v = update.license_number;
    update.license_number = typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null;
  }
  // Stamp therapist-initiated edits so the admin can see the profile changed.
  update.profile_updated_at = new Date().toISOString();

  // Check if therapist exists for this user
  const { data: existing } = await supabaseAdmin
    .from("therapists")
    .select("id, status, full_name, accepting_new_patients")
    .eq("user_id", user.id)
    .single();

  // Stamp availability changes (only real flips — the form re-sends the whole
  // state on every save) so the admin can see "לא זמין מאז...".
  if (
    existing &&
    typeof update.accepting_new_patients === "boolean" &&
    update.accepting_new_patients !== (existing.accepting_new_patients !== false)
  ) {
    update.accepting_new_changed_at = new Date().toISOString();
  }

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
