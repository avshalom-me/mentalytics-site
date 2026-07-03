import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { cancelSubscription, listRecurringForCustomer, type RecurringItem } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import {
  sendPromotionEndedEmail,
  sendPromotionGrantedEmail,
  sendTherapistWelcomeEmail,
  sendTherapistRejectedEmail,
  sendTherapistCompletionRequestEmail,
  sendTherapistAdminMessageEmail,
  sendPromotedApprovedEmail,
} from "@/app/lib/therapist-emails";
import { missingProfileFields, defaultCompletionMessage } from "@/app/lib/profile-completeness";

type TherapistRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  gender: string | null;
  online: boolean | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  assessment_types: string[] | null;
  regions: string[] | null;
  cultural_prefs: string[] | null;
  arrangements: string[] | null;
  age_groups: string[] | null;
  languages: string[] | null;
  couples_modalities: string[] | null;
  cogfun_age_groups: string[] | null;
  education: string | null;
  experience: string | null;
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
  profile_photo_path: string | null;
  status: string | null;
  manually_promoted: boolean | null;
  promotion_source: string | null;
  promoted_until: string | null;
  admin_approved: boolean | null;
  created_at: string | null;
  completion_requested_at: string | null;
  profile_updated_at: string | null;
};

const PROFILE_PHOTOS_BUCKET = "therapist-certificates";

function normalizeStoragePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// Sign many storage paths in a SINGLE request instead of one round-trip each.
// The admin list load used to call createSignedUrl() per photo AND per
// certificate — hundreds of sequential Storage calls that dominated load time
// (and got worse with every new therapist). createSignedUrls (plural) collapses
// that into one call per bucket. Returns a map from normalized path → signed URL.
async function batchSignUrls(paths: string[], expiresIn: number): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return map;
  const { data, error } = await supabaseAdmin.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrls(unique, expiresIn);
  if (error || !data) return map;
  for (const item of data) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

async function buildTherapistsResponse(onlyId?: string) {
  let query = supabaseAdmin
    .from("therapists")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      bio,
      gender,
      online,
      therapist_types,
      training_areas,
      assessment_types,
      regions,
      cultural_prefs,
      arrangements,
      age_groups,
      languages,
      couples_modalities,
      cogfun_age_groups,
      education,
      experience,
      style_q1,
      style_q2,
      activity_level,
      profile_photo_path,
      status,
      manually_promoted,
      promotion_source,
      promoted_until,
      admin_approved,
      created_at,
      completion_requested_at,
      profile_updated_at
      `
    )
    .order("full_name", { ascending: true });
  if (onlyId) query = query.eq("id", onlyId);

  // Certificates and subscriptions don't need the therapist list first: every
  // row in those tables belongs to a therapist anyway, so on the full-list
  // path we fetch them WHOLE in parallel with the therapists query instead of
  // filtering by ids afterwards. This collapses the request waterfall
  // (therapists → certs → sign → engagement/subs) from four network hops to
  // two — the hops, not the DB work, dominated the load time.
  let certQuery = supabaseAdmin
    .from("therapist_certificates")
    .select("id, therapist_id, file_path, original_name, content_type, created_at")
    .order("created_at", { ascending: true });
  if (onlyId) certQuery = certQuery.eq("therapist_id", onlyId);

  let subsQuery = supabaseAdmin
    .from("subscriptions")
    .select("therapist_id, status, current_period_end, promo_reverts_at");
  if (onlyId) subsQuery = subsQuery.eq("therapist_id", onlyId);

  const [{ data, error }, { data: certData }, subsRes] = await Promise.all([
    query,
    certQuery,
    subsQuery,
  ]);

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      therapists: [],
    };
  }

  const rows = (data ?? []) as TherapistRow[];

  type CertItem = {
    id: string;
    original_name: string;
    content_type: string;
    signed_url: string | null;
  };
  const certsByTherapist: Record<string, CertItem[]> = {};
  const therapistIds = rows.map((r) => r.id);

  type CertRow = {
    id: string;
    therapist_id: string;
    file_path: string;
    original_name: string | null;
    content_type: string | null;
  };
  const certRows: CertRow[] = (certData ?? []) as CertRow[];

  // 24h expiry: the admin tab routinely stays open for hours — a 1h URL made
  // photos/certs silently break mid-session. Sign every photo AND certificate
  // in ONE batched Storage call (they share a bucket) instead of one call each.
  const SIGN_TTL = 60 * 60 * 24;
  const pathsToSign: string[] = [];
  for (const r of rows) {
    if (r.profile_photo_path) pathsToSign.push(normalizeStoragePath(r.profile_photo_path));
  }
  for (const c of certRows) pathsToSign.push(normalizeStoragePath(c.file_path));

  // Second (and last) network hop: URL signing + engagement aggregate together.
  const monthAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [signedByPath, engagement] = await Promise.all([
    batchSignUrls(pathsToSign, SIGN_TTL),
    therapistIds.length > 0
      ? supabaseAdmin.rpc("admin_engagement_counts", { ids: therapistIds, since: monthAgoIso })
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
  ]);

  for (const c of certRows) {
    (certsByTherapist[c.therapist_id] ||= []).push({
      id: c.id,
      original_name: c.original_name ?? "תעודה",
      content_type: c.content_type ?? "",
      signed_url: signedByPath.get(normalizeStoragePath(c.file_path)) ?? null,
    });
  }

  // ── Per-therapist 30-day engagement + subscription health ──
  // Engagement counts come from a DB-side aggregate (fetched above, in
  // parallel with URL signing) instead of pulling every row and counting in
  // memory — the views table grows fast during campaigns and blew past the
  // 1000-row cap. Falls back to the row-pull method if the RPC isn't deployed.
  const viewsByTherapist: Record<string, number> = {};
  const contactsByTherapist: Record<string, number> = {};
  const subByTherapist: Record<
    string,
    { status: string; current_period_end: string | null; promo_reverts_at: string | null }
  > = {};

  if (therapistIds.length > 0) {
    if (!engagement.error && Array.isArray(engagement.data)) {
      for (const row of engagement.data as Array<{
        therapist_id: string;
        views_30d: number | string;
        contacts_30d: number | string;
      }>) {
        viewsByTherapist[row.therapist_id] = Number(row.views_30d) || 0;
        contactsByTherapist[row.therapist_id] = Number(row.contacts_30d) || 0;
      }
    } else {
      // Fallback: RPC not available — page past the 1000-row cap and count in memory.
      const [views, clicks] = await Promise.all([
        fetchAllRows<{ therapist_id: string }>(() =>
          supabaseAdmin
            .from("therapist_profile_views")
            .select("therapist_id")
            .in("therapist_id", therapistIds)
            .in("source", ["match", "directory"])
            .gte("viewed_at", monthAgoIso),
        ),
        fetchAllRows<{ therapist_id: string }>(() =>
          supabaseAdmin
            .from("therapist_contact_clicks")
            .select("therapist_id")
            .in("therapist_id", therapistIds)
            .gte("clicked_at", monthAgoIso),
        ),
      ]);
      for (const v of views) {
        viewsByTherapist[v.therapist_id] = (viewsByTherapist[v.therapist_id] ?? 0) + 1;
      }
      for (const c of clicks) {
        contactsByTherapist[c.therapist_id] = (contactsByTherapist[c.therapist_id] ?? 0) + 1;
      }
    }

    for (const s of (subsRes.data ?? []) as Array<{
      therapist_id: string;
      status: string;
      current_period_end: string | null;
      promo_reverts_at: string | null;
    }>) {
      // Prefer the active subscription when a therapist has more than one row.
      const prev = subByTherapist[s.therapist_id];
      if (!prev || s.status === "active") {
        subByTherapist[s.therapist_id] = {
          status: s.status,
          current_period_end: s.current_period_end,
          promo_reverts_at: s.promo_reverts_at,
        };
      }
    }
  }

  const therapists = rows.map((t) => {
      const profile_photo_url = t.profile_photo_path
        ? signedByPath.get(normalizeStoragePath(t.profile_photo_path)) ?? null
        : null;

      return {
        id: t.id,
        full_name: t.full_name ?? "",
        email: t.email ?? "",
        phone: t.phone ?? "",
        bio: t.bio ?? "",
        gender: t.gender ?? "",
        online: t.online ?? false,
        therapist_types: t.therapist_types ?? [],
        training_areas: t.training_areas ?? [],
        assessment_types: t.assessment_types ?? [],
        regions: t.regions ?? [],
        cultural_prefs: t.cultural_prefs ?? [],
        arrangements: t.arrangements ?? [],
        age_groups: t.age_groups ?? [],
        languages: t.languages ?? [],
        couples_modalities: t.couples_modalities ?? [],
        cogfun_age_groups: t.cogfun_age_groups ?? [],
        education: t.education ?? "",
        experience: t.experience ?? "",
        style_q1: t.style_q1 ?? null,
        style_q2: t.style_q2 ?? null,
        activity_level: t.activity_level ?? null,
        profile_photo_path: t.profile_photo_path ?? null,
        profile_photo_url,
        certificates: certsByTherapist[t.id] ?? [],
        status: t.status ?? "",
        manually_promoted: t.manually_promoted ?? false,
        promotion_source: t.promotion_source ?? null,
        promoted_until: t.promoted_until ?? null,
        admin_approved: t.admin_approved ?? false,
        created_at: t.created_at ?? null,
        completion_requested_at: t.completion_requested_at ?? null,
        profile_updated_at: t.profile_updated_at ?? null,
        views_30d: viewsByTherapist[t.id] ?? 0,
        contacts_30d: contactsByTherapist[t.id] ?? 0,
        subscription: subByTherapist[t.id] ?? null,
        missing: missingProfileFields(t, (certsByTherapist[t.id]?.length ?? 0) > 0),
      };
    });

  return {
    ok: true as const,
    error: "",
    therapists,
  };
}

export async function GET(request: Request) {
  // ?id=<uuid> → fetch one therapist fresh. Used by the edit modal so the
  // admin never edits (and overwrites with) a stale page-load snapshot.
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  const result = await buildTherapistsResponse(id);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, therapists: result.therapists },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;
    const status = body?.status;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing therapist id" },
        { status: 400 }
      );
    }

    // Approve a paid-but-unapproved therapist for public listing — flips
    // admin_approved on WITHOUT changing their paying status. This is how a
    // therapist who paid during signup becomes visible: only after the admin
    // has vetted them. (Pending/free therapists are approved via the normal
    // status='approved' path, which also sets admin_approved.)
    if (body.action === "approve_listing") {
      const { data: beforeListing } = await supabaseAdmin
        .from("therapists")
        .select("admin_approved, email, full_name")
        .eq("id", id)
        .single();
      const { error } = await supabaseAdmin
        .from("therapists")
        .update({ admin_approved: true })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      await writeAudit(supabaseAdmin, {
        therapistId: id,
        actorType: "admin",
        action: "approve_listing",
        before: { admin_approved: false },
        after: { admin_approved: true },
        reason: "admin approved therapist for public listing",
      });
      // Joyful "you're live" congrats — only on a genuine false→true transition,
      // so a re-approve doesn't re-send it.
      if (beforeListing && !beforeListing.admin_approved && beforeListing.email) {
        try {
          await sendPromotedApprovedEmail({
            to: beforeListing.email,
            name: beforeListing.full_name ?? "",
          });
        } catch (e) {
          console.error("approve_listing: promoted-approved email failed:", e);
        }
      }
      return NextResponse.json({ ok: true, id, admin_approved: true });
    }

    // Admin-triggered "request completion" — emails the therapist the exact
    // missing items (last name / certificate) and links to the dashboard,
    // WITHOUT changing their status. A soft alternative to rejection for a
    // merely-incomplete submission.
    if (body.action === "request_completion") {
      const { data: t } = await supabaseAdmin
        .from("therapists")
        .select("id, full_name, email, profile_photo_path, regions, therapist_types, training_areas")
        .eq("id", id)
        .single();
      if (!t || !t.email) {
        return NextResponse.json({ ok: false, error: "therapist not found or has no email" }, { status: 404 });
      }
      const { count: certCount } = await supabaseAdmin
        .from("therapist_certificates")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", id);
      const missing = missingProfileFields(t, !!certCount);
      // The admin writes the message; fall back to a generated draft only if
      // none was provided (e.g. an older client).
      const message =
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim().slice(0, 4000)
          : defaultCompletionMessage(missing);
      const sent = await sendTherapistCompletionRequestEmail({
        to: t.email,
        name: t.full_name ?? "",
        message,
      });
      if (!sent.ok) {
        return NextResponse.json({ ok: false, error: sent.error || "email failed" }, { status: 502 });
      }
      // Record that (and when) the request went out, so the admin UI can show it.
      const requestedAt = new Date().toISOString();
      const { error: stampErr } = await supabaseAdmin
        .from("therapists")
        .update({ completion_requested_at: requestedAt })
        .eq("id", id);
      if (stampErr) {
        console.error(`request_completion: failed to stamp completion_requested_at for ${id}:`, stampErr.message);
      }
      await writeAudit(supabaseAdmin, {
        therapistId: id,
        actorType: "admin",
        action: "request_completion",
        before: {},
        // Full message text included so the audit trail can reconstruct exactly
        // what was emailed (it's admin-authored free text).
        after: { missing, message },
        reason: "admin requested profile completion",
      });
      return NextResponse.json({ ok: true, id, missing, completion_requested_at: requestedAt });
    }

    // Admin-triggered GENERAL message — a free-text note with a custom subject
    // and a direct edit-profile link, for a therapist who has nothing formally
    // "missing" but still needs to fix something (e.g. a certificate uploaded
    // into the photo slot). Does NOT change status or the completion badge.
    if (body.action === "send_message") {
      const { data: t } = await supabaseAdmin
        .from("therapists")
        .select("id, full_name, email")
        .eq("id", id)
        .single();
      if (!t || !t.email) {
        return NextResponse.json({ ok: false, error: "therapist not found or has no email" }, { status: 404 });
      }
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
      const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
      if (!message) {
        return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
      }
      const sent = await sendTherapistAdminMessageEmail({
        to: t.email,
        name: t.full_name ?? "",
        subject,
        message,
      });
      if (!sent.ok) {
        return NextResponse.json({ ok: false, error: sent.error || "email failed" }, { status: 502 });
      }
      await writeAudit(supabaseAdmin, {
        therapistId: id,
        actorType: "admin",
        action: "admin_message",
        before: {},
        // Full message text included so the audit trail can reconstruct exactly
        // what was emailed (it's admin-authored free text).
        after: { subject, message },
        reason: "admin sent a message to the therapist",
      });
      return NextResponse.json({ ok: true, id });
    }

    // Admin deletes a single certificate (e.g. the therapist uploaded the wrong
    // file). Removes the storage object and the row. Scoped to this therapist.
    if (body.action === "delete_cert") {
      const certId = typeof body.certId === "string" ? body.certId : "";
      if (!certId) {
        return NextResponse.json({ ok: false, error: "certId required" }, { status: 400 });
      }
      const { data: cert } = await supabaseAdmin
        .from("therapist_certificates")
        .select("id, therapist_id, file_path")
        .eq("id", certId)
        .single();
      if (!cert || cert.therapist_id !== id) {
        return NextResponse.json({ ok: false, error: "certificate not found" }, { status: 404 });
      }
      // Remove the file first (best-effort); the row is the source of truth for
      // the UI, so a storage-remove hiccup must not block deleting the row.
      await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).remove([cert.file_path]);
      const { error: delErr } = await supabaseAdmin
        .from("therapist_certificates")
        .delete()
        .eq("id", certId);
      if (delErr) {
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }
      await writeAudit(supabaseAdmin, {
        therapistId: id,
        actorType: "admin",
        action: "delete_cert",
        before: { file_path: cert.file_path },
        after: {},
        reason: "admin deleted a certificate",
      });
      return NextResponse.json({ ok: true, id, certId });
    }

    // ── On-demand Sumit reconciliation ──────────────────────────────────────
    // Closes the gap where a standing order is still ACTIVE at Sumit but the
    // local subscription is already 'cancelled' — the status-change cancel
    // paths only look at status='active' subs, so they can never reach it.
    // Here we check EVERY subscription that carries a Sumit recurring id
    // (regardless of local status) and cancel any that are still live, so an
    // admin isn't blind to a charge that keeps running. The daily cron does
    // the same sweep automatically; this is the immediate, per-therapist
    // version with a verified cancel.
    if (body.action === "reconcile_sumit") {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, morning_token_id")
        .eq("therapist_id", id)
        .not("morning_token_id", "is", null);

      const result = {
        checked: 0,
        cancelled: 0,
        alreadyInactive: 0,
        notFound: 0,
        failed: 0,
        unlinkedActive: 0,
        details: [] as string[],
      };

      if (!subs || subs.length === 0) {
        // No local subs with a token — but there could still be an orphaned
        // standing order at Sumit with no local record. Surface it.
        try {
          const items = await listRecurringForCustomer({ externalIdentifier: id, includeInactive: true });
          for (const item of items) {
            if (item.Status === 0) {
              result.unlinkedActive++;
              result.details.push(`⚠️ הוראת קבע ${item.ID}: פעילה ב-Sumit אך אינה מקושרת לרשומה מקומית — בדקו ידנית.`);
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          return NextResponse.json({ ok: false, error: `בדיקה מול Sumit נכשלה: ${message}` }, { status: 502 });
        }
        return NextResponse.json({ ok: true, reconcile: result });
      }

      // One Sumit lookup for the whole customer, then match each local sub.
      let items: RecurringItem[] = [];
      try {
        items = await listRecurringForCustomer({ externalIdentifier: id, includeInactive: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        return NextResponse.json({ ok: false, error: `בדיקה מול Sumit נכשלה: ${message}` }, { status: 502 });
      }

      for (const sub of subs) {
        const recurringId = sub.morning_token_id as string;
        result.checked++;
        const target = items.find((i) => String(i.ID) === recurringId);

        if (!target) {
          result.notFound++;
          result.details.push(`הוראת קבע ${recurringId}: לא נמצאה ב-Sumit תחת המטפל הזה — ייתכן שאינה מקושרת לחשבון או שזהו מזהה ישן שאינו פעיל.`);
          continue;
        }
        if (target.Status !== 0) {
          result.alreadyInactive++;
          result.details.push(`הוראת קבע ${recurringId}: כבר לא פעילה ב-Sumit.`);
          if (sub.status === "active") {
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .eq("id", sub.id);
          }
          continue;
        }

        // Active at Sumit → cancel for real (cancelSubscription re-reads and
        // throws if the cancel didn't take effect).
        try {
          await cancelSubscription({ recurringItemId: parseInt(recurringId, 10), customerExternalId: id });
          result.cancelled++;
          result.details.push(`הוראת קבע ${recurringId}: בוטלה עכשיו ב-Sumit ✓`);
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          await writeAudit(supabaseAdmin, {
            therapistId: id,
            actorType: "admin",
            action: "sumit_reconcile_cancelled",
            before: { sumit_recurring: recurringId, sumit_status: "active", local_status: sub.status },
            after: { sumit_status: "cancelled", local_status: "cancelled" },
            reason: "admin_on_demand_reconcile",
          });
        } catch (cancelErr) {
          result.failed++;
          const message = cancelErr instanceof Error ? cancelErr.message : "unknown error";
          result.details.push(`הוראת קבע ${recurringId}: ביטול נכשל — ${message}`);
          await writeAudit(supabaseAdmin, {
            therapistId: id,
            actorType: "admin",
            action: "sumit_reconcile_failed",
            before: { sumit_recurring: recurringId, sumit_status: "active", local_status: sub.status },
            after: null,
            reason: `cancel_failed: ${message}`,
          });
        }
      }

      // Surface any ACTIVE Sumit order not linked to a local sub (true orphan).
      const localTokens = new Set(subs.map((s) => String(s.morning_token_id)));
      for (const item of items) {
        if (item.Status === 0 && !localTokens.has(String(item.ID))) {
          result.unlinkedActive++;
          result.details.push(`⚠️ הוראת קבע ${item.ID}: פעילה ב-Sumit אך אינה מקושרת לרשומה מקומית — בדקו ידנית.`);
        }
      }

      return NextResponse.json({ ok: true, reconcile: result });
    }

    // עדכון שדות מלאים (עריכה)
    if (body.fields) {
      const allowed = ["full_name","email","phone","bio","gender","online","therapist_types","training_areas","assessment_types","regions","cultural_prefs","arrangements"];
      const update: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body.fields) update[key] = body.fields[key];
      }
      // Therapeutic-style answers (1–7 scale). Coerce to a valid smallint or
      // null so an out-of-range/blank value clears the field rather than erroring.
      for (const key of ["style_q1","style_q2","activity_level"]) {
        if (key in body.fields) {
          const n = Number(body.fields[key]);
          update[key] = Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
        }
      }
      const { error } = await supabaseAdmin.from("therapists").update(update).eq("id", id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id });
    }

    if (!status || !["approved", "rejected", "pending", "paying"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    // Snapshot current state for the audit log and for downstream logic
    // (we need to know whether they were already paying, etc.).
    const { data: before } = await supabaseAdmin
      .from("therapists")
      .select(
        "status, manually_promoted, promotion_source, promoted_since, promoted_until, email, full_name, bio, profile_photo_path, training_areas, therapist_types, regions, education, experience, languages"
      )
      .eq("id", id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ ok: false, error: "Therapist not found" }, { status: 404 });
    }

    // Optional expiry date for trial promotions. Admin can pass null/omit
    // for an indefinite manual promotion, or a future date for a trial.
    const promotedUntilRaw = body?.promoted_until;
    let promotedUntilIso: string | null = null;
    if (promotedUntilRaw) {
      const d = new Date(promotedUntilRaw);
      if (isNaN(d.getTime()) || d.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, error: "promoted_until must be a future date" },
          { status: 400 }
        );
      }
      promotedUntilIso = d.toISOString();
    }

    const extraFields: Record<string, unknown> = {};
    let endedEmailReason: "admin_demote" | "customer_cancellation" | null = null;
    let sendGrantedEmail = false;
    let convertedFromPaying = false;
    let sendFreeWelcome = false;
    let sendRejectedEmail = false;
    const rejectionReason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (status === "paying") {
      // Admin is promoting (or re-promoting). If the therapist is *already*
      // a real paying customer at Sumit, the admin is effectively giving
      // them a freebie on top — cancel the standing order so we don't keep
      // charging the card while showing them as a "manual" promotion. This
      // closes the silent double-bill in scenario #2 of the audit.
      const { data: activeSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, morning_token_id")
        .eq("therapist_id", id)
        .eq("status", "active")
        .maybeSingle();

      if (activeSub && activeSub.morning_token_id) {
        try {
          await cancelSubscription({
            recurringItemId: parseInt(activeSub.morning_token_id, 10),
            customerExternalId: id,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "unknown error";
          console.error(`Admin promote-over-paying: Sumit cancel failed for ${id}:`, message);
          return NextResponse.json(
            {
              ok: false,
              error:
                "המטפל כבר משלם — ביטול הוראת הקבע ב-Sumit נכשל. בטלו ידנית ב-Sumit לפני קידום ידני.",
            },
            { status: 502 }
          );
        }
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activeSub.id);
      } else if (activeSub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activeSub.id);
        console.warn(
          `Admin promote: subscription ${activeSub.id} for therapist ${id} had no morning_token_id; cancelled locally only.`
        );
      }

      extraFields.manually_promoted = true; // legacy column, kept in sync
      extraFields.promotion_source = promotedUntilIso ? "trial" : "manual";
      extraFields.promoted_since = new Date().toISOString();
      extraFields.promoted_until = promotedUntilIso;

      // Always notify of the gift. If the therapist was previously paying,
      // the email also explains that their Sumit subscription was cancelled
      // — otherwise they'd see no charge next month and wonder.
      sendGrantedEmail = true;
      if (before.status === "paying" && before.promotion_source === "paid") {
        convertedFromPaying = true;
      }
    }

    if (status === "approved" || status === "rejected") {
      extraFields.manually_promoted = false;
      extraFields.promotion_source = null;
      extraFields.promoted_since = null;
      extraFields.promoted_until = null;

      // First-time approval (pending → approved): send the free onboarding
      // email with profile feedback + an invitation to write an article. Only
      // on the pending→approved transition, so re-approvals don't re-send it.
      if (status === "approved" && before.status === "pending") {
        sendFreeWelcome = true;
      }

      // Store/clear the rejection reason. On rejection (e.g. an unreadable
      // certificate) notify the therapist so they can fix and re-submit —
      // except for paying→rejected, which already gets a cancellation email.
      if (status === "rejected") {
        extraFields.rejection_reason = rejectionReason || null;
        if (before.status !== "paying") sendRejectedEmail = true;
      } else {
        extraFields.rejection_reason = null;
      }

      // If the therapist had an active subscription, cancel it at Sumit
      // before flipping local status. Failure must be reported (chargeback
      // risk: customer keeps getting charged while shown as "approved").
      const { data: activeSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, morning_token_id")
        .eq("therapist_id", id)
        .eq("status", "active")
        .maybeSingle();

      if (activeSub && activeSub.morning_token_id) {
        try {
          await cancelSubscription({
            recurringItemId: parseInt(activeSub.morning_token_id, 10),
            customerExternalId: id,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "unknown error";
          console.error(`Admin demote: Sumit cancel failed for therapist ${id}:`, message);
          return NextResponse.json(
            {
              ok: false,
              error:
                "ביטול הוראת הקבע ב-Sumit נכשל. בטלו ידנית ב-Sumit UI לפני שינוי הסטטוס.",
            },
            { status: 502 }
          );
        }

        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activeSub.id);
      } else if (activeSub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activeSub.id);
        console.warn(
          `Admin demote: subscription ${activeSub.id} for therapist ${id} had no morning_token_id; cancelled locally only.`
        );
      }

      // If the therapist was on any promoted tier before (paid/manual/
      // trial), notify them by email that their access has ended. The
      // wording differs based on whether they were a paying customer
      // (customer_cancellation) or a free gift (admin_demote). Skip if
      // they were never promoted in the first place (pending → approved
      // is a normal first-time approval and doesn't need a notification).
      if (before.status === "paying") {
        endedEmailReason =
          before.promotion_source === "paid" ? "customer_cancellation" : "admin_demote";
      }
    }

    // Vetting flag: approving/promoting marks the therapist admin-approved
    // (allowed in the public list + matching); rejecting / returning-to-pending
    // clears it. Separate from the paying tier so a paid therapist stays hidden
    // until vetted.
    extraFields.admin_approved = status === "approved" || status === "paying";

    const { error } = await supabaseAdmin
      .from("therapists")
      .update({ status, ...extraFields })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // Fire the email AFTER the DB commit so the customer never gets a
    // "your promotion ended" message that turned out not to be true.
    if (endedEmailReason && before.email) {
      await sendPromotionEndedEmail({
        to: before.email,
        name: before.full_name ?? "",
        reason: endedEmailReason,
      });
    }
    if (sendGrantedEmail && before.email) {
      const giftMonths = Number.isInteger(body?.gift_months) ? Number(body.gift_months) : null;
      await sendPromotionGrantedEmail({
        to: before.email,
        name: before.full_name ?? "",
        source: promotedUntilIso ? "trial" : "manual",
        promotedUntilIso,
        wasPreviouslyPaying: convertedFromPaying,
        giftMonths,
      });
    }
    if (sendFreeWelcome && before.email) {
      await sendTherapistWelcomeEmail({
        to: before.email,
        tier: "free",
        therapist: before,
      });
    }
    if (sendRejectedEmail && before.email) {
      await sendTherapistRejectedEmail({
        to: before.email,
        name: before.full_name ?? "",
        reason: rejectionReason || undefined,
      });
    }

    await writeAudit(supabaseAdmin, {
      therapistId: id,
      actorType: "admin",
      action: `status_change:${before.status ?? "null"}->${status}`,
      before: {
        status: before.status,
        promotion_source: before.promotion_source,
        promoted_until: before.promoted_until,
      },
      after: {
        status,
        promotion_source: extraFields.promotion_source ?? null,
        promoted_until: extraFields.promoted_until ?? null,
      },
      reason: body?.reason ?? null,
    });

    return NextResponse.json({ ok: true, id, status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing therapist id" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("therapists")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}