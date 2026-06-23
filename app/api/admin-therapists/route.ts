import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { cancelSubscription, listRecurringForCustomer, type RecurringItem } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import {
  sendPromotionEndedEmail,
  sendPromotionGrantedEmail,
  sendTherapistWelcomeEmail,
  sendTherapistRejectedEmail,
  sendTherapistCompletionRequestEmail,
} from "@/app/lib/therapist-emails";
import { missingProfileFields } from "@/app/lib/profile-completeness";

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
  profile_photo_path: string | null;
  status: string | null;
  manually_promoted: boolean | null;
  promotion_source: string | null;
  promoted_until: string | null;
  admin_approved: boolean | null;
};

const PROFILE_PHOTOS_BUCKET = "therapist-certificates";

function normalizeStoragePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function buildTherapistsResponse() {
  const { data, error } = await supabaseAdmin
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
      profile_photo_path,
      status,
      manually_promoted,
      promotion_source,
      promoted_until,
      admin_approved
      `
    )
    .order("full_name", { ascending: true });

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      therapists: [],
    };
  }

  const rows = (data ?? []) as TherapistRow[];

  // Fetch all certificate documents for these therapists and generate signed
  // URLs so the admin can review them before approving/rejecting.
  type CertItem = {
    id: string;
    original_name: string;
    content_type: string;
    signed_url: string | null;
  };
  const certsByTherapist: Record<string, CertItem[]> = {};
  const therapistIds = rows.map((r) => r.id);

  if (therapistIds.length > 0) {
    const { data: certData } = await supabaseAdmin
      .from("therapist_certificates")
      .select("id, therapist_id, file_path, original_name, content_type, created_at")
      .in("therapist_id", therapistIds)
      .order("created_at", { ascending: true });

    await Promise.all(
      ((certData ?? []) as Array<{
        id: string;
        therapist_id: string;
        file_path: string;
        original_name: string | null;
        content_type: string | null;
      }>).map(async (c) => {
        let signed_url: string | null = null;
        const { data: signedData, error: signedError } =
          await supabaseAdmin.storage
            .from(PROFILE_PHOTOS_BUCKET)
            .createSignedUrl(normalizeStoragePath(c.file_path), 60 * 60);
        if (!signedError && signedData?.signedUrl) {
          signed_url = signedData.signedUrl;
        }
        (certsByTherapist[c.therapist_id] ||= []).push({
          id: c.id,
          original_name: c.original_name ?? "תעודה",
          content_type: c.content_type ?? "",
          signed_url,
        });
      })
    );
  }

  const therapists = await Promise.all(
    rows.map(async (t) => {
      let profile_photo_url: string | null = null;

      if (t.profile_photo_path) {
        const normalizedPath = normalizeStoragePath(t.profile_photo_path);

        const { data: signedData, error: signedError } =
          await supabaseAdmin.storage
            .from(PROFILE_PHOTOS_BUCKET)
            .createSignedUrl(normalizedPath, 60 * 60);

        if (!signedError && signedData?.signedUrl) {
          profile_photo_url = signedData.signedUrl;
        }
      }

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
        profile_photo_path: t.profile_photo_path ?? null,
        profile_photo_url,
        certificates: certsByTherapist[t.id] ?? [],
        status: t.status ?? "",
        manually_promoted: t.manually_promoted ?? false,
        promotion_source: t.promotion_source ?? null,
        promoted_until: t.promoted_until ?? null,
        admin_approved: t.admin_approved ?? false,
        created_at: null,
      };
    })
  );

  return {
    ok: true as const,
    error: "",
    therapists,
  };
}

export async function GET() {
  const result = await buildTherapistsResponse();

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
      const sent = await sendTherapistCompletionRequestEmail({
        to: t.email,
        name: t.full_name ?? "",
        missing,
      });
      await writeAudit(supabaseAdmin, {
        therapistId: id,
        actorType: "admin",
        action: "request_completion",
        before: {},
        after: { missing },
        reason: "admin requested profile completion",
      });
      if (!sent.ok) {
        return NextResponse.json({ ok: false, error: sent.error || "email failed" }, { status: 502 });
      }
      return NextResponse.json({ ok: true, id, missing });
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
      await sendPromotionGrantedEmail({
        to: before.email,
        name: before.full_name ?? "",
        source: promotedUntilIso ? "trial" : "manual",
        promotedUntilIso,
        wasPreviouslyPaying: convertedFromPaying,
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