import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { cancelSubscription } from "@/app/lib/sumit";

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
      manually_promoted
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

    // כשמקדמים ידנית → סימון; כשמורידים חזרה → ביטול הסימון
    const extraFields: Record<string, unknown> = {};
    if (status === "paying") {
      extraFields.manually_promoted = true;
      extraFields.promoted_since = new Date().toISOString();
    }
    if (status === "approved" || status === "rejected") {
      extraFields.manually_promoted = false;
      extraFields.promoted_since = null;

      // If this therapist has an active subscription at Sumit (real paying
      // customer, not a manually-promoted free account), cancelling them
      // locally is not enough — Sumit would keep charging their card every
      // month while their status here is "approved". Cancel at Sumit first
      // and mark the row 'cancelled' locally. If the Sumit call fails we
      // surface a 502 with a clear message so the admin can resolve the
      // mismatch manually in Sumit's UI before the status flips locally.
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
        // Subscription row exists but no recurring id — orphan from before
        // we captured the id. Mark cancelled locally; admin should also
        // verify no leftover at Sumit.
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activeSub.id);
        console.warn(
          `Admin demote: subscription ${activeSub.id} for therapist ${id} had no morning_token_id; cancelled locally only.`
        );
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