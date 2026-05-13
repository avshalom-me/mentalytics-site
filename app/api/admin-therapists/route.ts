import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { cancelSubscription } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import { sendPromotionEndedEmail, sendPromotionGrantedEmail } from "@/app/lib/therapist-emails";

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
      promoted_until
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
        status: t.status ?? "",
        manually_promoted: t.manually_promoted ?? false,
        promotion_source: t.promotion_source ?? null,
        promoted_until: t.promoted_until ?? null,
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
      .select("status, manually_promoted, promotion_source, promoted_since, promoted_until, email, full_name")
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