import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

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
  regions: string[] | null;
  cultural_prefs: string[] | null;
  arrangements: string[] | null;
  profile_photo_path: string | null;
  status: string | null;
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
      regions,
      cultural_prefs,
      arrangements,
      profile_photo_path,
      status
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
        regions: t.regions ?? [],
        cultural_prefs: t.cultural_prefs ?? [],
        arrangements: t.arrangements ?? [],
        profile_photo_path: t.profile_photo_path ?? null,
        profile_photo_url,
        status: t.status ?? "",
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

    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("therapists")
      .update({ status })
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