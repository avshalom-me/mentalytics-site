import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

function parseJsonArray(v: FormDataEntryValue | null): string[] {
  if (!v) return [];
  const parsed = JSON.parse(String(v));
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

// רק כדי שתוכל לפתוח בדפדפן ולראות שהנתיב חי
export async function GET() {
  return Response.json({ ok: true, message: "API is alive. Use POST to submit the form." });
}

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const fd = await req.formData();

    const fullName = String(fd.get("fullName") ?? "").trim();
    const gender = String(fd.get("gender") ?? "").trim();
    const online = String(fd.get("online") ?? "לא") === "כן";
    const priceRaw = String(fd.get("price") ?? "").trim();
    const price = priceRaw ? Number(priceRaw) : null;

    let therapistTypes: string[] = [];
    let trainingAreas: string[] = [];
    let couplesModalities: string[] = [];
    let regions: string[] = [];
    let culturalPrefs: string[] = [];
    let arrangements: string[] = [];

    try {
      therapistTypes = parseJsonArray(fd.get("therapistTypes"));
      trainingAreas = parseJsonArray(fd.get("trainingAreas"));
      couplesModalities = parseJsonArray(fd.get("couplesModalities"));
      regions = parseJsonArray(fd.get("regions"));
      culturalPrefs = parseJsonArray(fd.get("culturalPrefs"));
      arrangements = parseJsonArray(fd.get("arrangements"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "JSON לא תקין בשדות הבחירה" }), { status: 400 });
    }

    const errors: string[] = [];
    if (!fullName) errors.push("שם מלא חסר");
    if (!gender) errors.push("מגדר חסר");
    if (therapistTypes.length === 0) errors.push("סוג מטפל חסר");
    if (trainingAreas.length === 0) errors.push("תחומי הכשרה חסרים");
    if (trainingAreas.includes("טיפול זוגי") && couplesModalities.length === 0) {
      errors.push("נבחר טיפול זוגי ללא תת-סוגים");
    }
    if (regions.length === 0) errors.push("אזור חסר");
    if (priceRaw && Number.isNaN(Number(priceRaw))) errors.push("מחיר לא תקין");

    if (errors.length) {
      return new Response(JSON.stringify({ ok: false, errors }), { status: 400 });
    }

    // 1) יצירת מטפל
    const { data: therapist, error: insertErr } = await supabase
      .from("therapists")
      .insert({
        full_name: fullName,
        gender,
        online,
        price,
        therapist_types: therapistTypes,
        training_areas: trainingAreas,
        couples_modalities: couplesModalities,
        regions,
        cultural_prefs: culturalPrefs,
        arrangements,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !therapist) {
      return new Response(JSON.stringify({ ok: false, error: insertErr?.message ?? "Insert failed" }), { status: 500 });
    }

    // 2) תמונת פרופיל (אופציונלי)
    const profilePhoto = fd.get("profilePhoto") as File | null;
    if (profilePhoto && profilePhoto.size > 0) {
      if (profilePhoto.size <= 5 * 1024 * 1024) {
        const allowedImg = ["image/jpeg", "image/png"];
        if (!profilePhoto.type || allowedImg.includes(profilePhoto.type)) {
          const ab = await profilePhoto.arrayBuffer();
          const bytes = new Uint8Array(ab);

          const safeName = safeFileName(profilePhoto.name);
          const photoPath = `${therapist.id}/profile-photo-${Date.now()}-${safeName}`;

          const { error: photoErr } = await supabase.storage
            .from("therapist-certificates")
            .upload(photoPath, bytes, { contentType: profilePhoto.type, upsert: true });

          if (!photoErr) {
            await supabase.from("therapists").update({ profile_photo_path: photoPath }).eq("id", therapist.id);
          }
        }
      }
    }

    // 3) תעודות
    const files = fd.getAll("certificates").filter(Boolean) as File[];
    const uploadedCertificates: Array<{ path: string; name: string }> = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) continue;

      const allowed = ["application/pdf", "image/jpeg", "image/png"];
      if (file.type && !allowed.includes(file.type)) continue;

      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);

      const safeName = safeFileName(file.name);
      const path = `${therapist.id}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("therapist-certificates")
        .upload(path, bytes, { contentType: file.type, upsert: false });

      if (!upErr) {
        await supabase.from("therapist_certificates").insert({
          therapist_id: therapist.id,
          file_path: path,
          original_name: file.name,
          content_type: file.type,
          size_bytes: file.size,
        });
        uploadedCertificates.push({ path, name: file.name });
      }
    }

       return new Response(
      JSON.stringify({ ok: true, therapistId: therapist.id, uploadedCertificates }),
      { status: 200 }
    );
  } catch (e: any) {
    console.error("SIGNUP API ERROR:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? String(e) }),
      { status: 500 }
    );
  }
}