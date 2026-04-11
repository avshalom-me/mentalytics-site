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

const PROFILE_PHOTOS_BUCKET =
  process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";

export async function GET() {
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
    .in("status", ["approved", "paying"])
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as TherapistRow[];

  const therapists = await Promise.all(
    rows.map(async (t) => {
      let profile_photo_url: string | null = null;

      if (t.profile_photo_path) {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .createSignedUrl(t.profile_photo_path, 60 * 60);

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
      };
    })
  );

  return NextResponse.json(
    { ok: true, therapists },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}