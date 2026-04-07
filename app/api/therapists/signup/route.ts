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

function getSafeFileName(originalName: string, prefix = "file") {
  const lastDotIndex = originalName.lastIndexOf(".");
  const ext =
    lastDotIndex !== -1 ? originalName.slice(lastDotIndex + 1).toLowerCase() : "";

  const safeExt = ext ? `.${ext.replace(/[^a-z0-9]/g, "")}` : "";
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now();

  return `${prefix}_${timestamp}_${randomPart}${safeExt}`;
}

function parseJsonArray(v: FormDataEntryValue | null): string[] {
  if (!v) return [];

  const parsed = JSON.parse(String(v));
  if (!Array.isArray(parsed)) return [];

  return parsed.map((item) => String(item).trim()).filter(Boolean);
}

function parseBoolean(v: FormDataEntryValue | null, defaultValue = false) {
  if (v == null) return defaultValue;

  const value = String(v).trim().toLowerCase();

  if (["true", "1", "yes", "כן"].includes(value)) return true;
  if (["false", "0", "no", "לא"].includes(value)) return false;

  return defaultValue;
}

function parseOptionalInt(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;

  const raw = String(v).trim();
  if (!raw) return null;

  const num = Number(raw);
  if (!Number.isInteger(num)) return null;

  return num;
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "API is alive. Use POST to submit the form.",
  });
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
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const gender = String(fd.get("gender") ?? "").trim();
    const online = String(fd.get("online") ?? "לא") === "כן";
    const priceRaw = String(fd.get("price") ?? "").trim();
    const price = priceRaw ? Number(priceRaw) : null;
    const bio = String(fd.get("bio") ?? "").trim();
    const education = String(fd.get("education") ?? "").trim();
    const experience = String(fd.get("experience") ?? "").trim();

    let therapistTypes: string[] = [];
    let trainingAreas: string[] = [];
    let treatmentTypes: string[] = [];
    let couplesModalities: string[] = [];
    let ageGroups: string[] = [];
    let assessmentTypes: string[] = [];
    let regions: string[] = [];
    let culturalPrefs: string[] = [];
    let languages: string[] = [];
    let arrangements: string[] = [];
    let acceptingNewClients = true;
    let activityLevel: number | null = null;
    let styleQ1: number | null = null;
    let styleQ2: number | null = null;

    try {
      therapistTypes = parseJsonArray(fd.get("therapistTypes"));
      trainingAreas = parseJsonArray(fd.get("trainingAreas"));
      treatmentTypes = parseJsonArray(fd.get("treatmentTypes"));
      couplesModalities = parseJsonArray(fd.get("couplesModalities"));
      ageGroups = parseJsonArray(fd.get("ageGroups"));
      assessmentTypes = parseJsonArray(fd.get("assessmentTypes"));
      regions = parseJsonArray(fd.get("regions"));
      culturalPrefs = parseJsonArray(fd.get("culturalPrefs"));
      languages = parseJsonArray(fd.get("languages"));
      arrangements = parseJsonArray(fd.get("arrangements"));
      acceptingNewClients = parseBoolean(fd.get("acceptingNewClients"), true);
      activityLevel = parseOptionalInt(fd.get("activityLevel"));
      styleQ1 = parseOptionalInt(fd.get("styleQ1"));
      styleQ2 = parseOptionalInt(fd.get("styleQ2"));
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "JSON לא תקין בשדות הבחירה" }),
        { status: 400 }
      );
    }

    const normalizedTreatmentTypes =
      treatmentTypes.length > 0 ? treatmentTypes : trainingAreas;

    const errors: string[] = [];

    if (!fullName) errors.push("שם מלא חסר");
    if (!gender) errors.push("מגדר חסר");
    if (therapistTypes.length === 0) errors.push("סוג מטפל חסר");
    if (trainingAreas.length === 0) errors.push("תחומי הכשרה חסרים");
    if (normalizedTreatmentTypes.length === 0) errors.push("סוגי טיפול חסרים");
    if (trainingAreas.includes("טיפול זוגי") && couplesModalities.length === 0) {
      errors.push("נבחר טיפול זוגי ללא תת-סוגים");
    }
    if (ageGroups.length === 0) errors.push("קבוצות גיל חסרות");
    if (activityLevel === null || activityLevel < 1 || activityLevel > 7) {
      errors.push("סולם אקטיביות חייב להיות מספר בין 1 ל-7");
    }
    if (styleQ1 === null || styleQ1 < 1 || styleQ1 > 7) {
      errors.push("שאלת סגנון 1 חייבת להיות מספר בין 1 ל-7");
    }
    if (styleQ2 === null || styleQ2 < 1 || styleQ2 > 7) {
      errors.push("שאלת סגנון 2 חייבת להיות מספר בין 1 ל-7");
    }
    if (regions.length === 0) errors.push("אזור חסר");
    if (languages.length === 0) errors.push("שפות חסרות");
    if (priceRaw && Number.isNaN(Number(priceRaw))) errors.push("מחיר לא תקין");
    if (bio.length > 500) errors.push("התיאור האישי ארוך מדי");

    if (errors.length) {
      return new Response(JSON.stringify({ ok: false, errors }), {
        status: 400,
      });
    }

    const { data: therapist, error: insertErr } = await supabase
      .from("therapists")
      .insert({
        full_name: fullName,
        email,
        phone,
        gender,
        online,
        price,
          bio: bio || null,
        education: education || null,
        experience: experience || null,
        therapist_types: therapistTypes,
        training_areas: trainingAreas,
        treatment_types: normalizedTreatmentTypes,
        couples_modalities: couplesModalities,
        age_groups: ageGroups,
        assessment_types: assessmentTypes,
        activity_level: activityLevel,
        style_q1: styleQ1,
        style_q2: styleQ2,
        regions,
        cultural_prefs: culturalPrefs,
        languages,
        arrangements,
        accepting_new_clients: acceptingNewClients,
        status: "pending",
        public_visible: false,
      })
      .select("id")
      .single();

    if (insertErr || !therapist) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: insertErr?.message ?? "Insert failed",
        }),
        { status: 500 }
      );
    }

    const uploadWarnings: string[] = [];

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
            .upload(photoPath, bytes, {
              contentType: profilePhoto.type,
              upsert: true,
            });

          if (photoErr) {
            console.error("PROFILE PHOTO UPLOAD ERROR:", photoErr);
            uploadWarnings.push(`תמונת פרופיל: ${photoErr.message}`);
          } else {
            const { error: updatePhotoErr } = await supabase
              .from("therapists")
              .update({ profile_photo_path: photoPath })
              .eq("id", therapist.id);

            if (updatePhotoErr) {
              console.error("PROFILE PHOTO DB UPDATE ERROR:", updatePhotoErr);
              uploadWarnings.push(
                `שמירת נתיב תמונת פרופיל: ${updatePhotoErr.message}`
              );
            }
          }
        } else {
          uploadWarnings.push("תמונת פרופיל: סוג קובץ לא נתמך");
        }
      } else {
        uploadWarnings.push("תמונת פרופיל: הקובץ גדול מ-5MB");
      }
    }

    const files = fd.getAll("certificates").filter(Boolean) as File[];
    const uploadedCertificates: Array<{ path: string; name: string }> = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        uploadWarnings.push(`${file.name}: הקובץ גדול מ-10MB`);
        continue;
      }

      const allowed = ["application/pdf", "image/jpeg", "image/png"];
      if (file.type && !allowed.includes(file.type)) {
        uploadWarnings.push(`${file.name}: סוג קובץ לא נתמך`);
        continue;
      }

      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);

      const generatedFileName = getSafeFileName(file.name, "certificate");
      const path = `therapists/${therapist.id}/${generatedFileName}`;

      const { error: upErr } = await supabase.storage
        .from("therapist-certificates")
        .upload(path, bytes, {
          contentType: file.type,
          upsert: false,
        });

      if (upErr) {
        console.error("CERTIFICATE UPLOAD ERROR:", file.name, upErr);
        uploadWarnings.push(`${file.name}: ${upErr.message}`);
        continue;
      }

      const { error: certInsertErr } = await supabase
        .from("therapist_certificates")
        .insert({
          therapist_id: therapist.id,
          file_path: path,
          original_name: file.name,
          content_type: file.type,
          size_bytes: file.size,
        });

      if (certInsertErr) {
        console.error("CERTIFICATE DB INSERT ERROR:", file.name, certInsertErr);
        uploadWarnings.push(
          `${file.name}: נשמר ב-bucket אבל לא נרשם בטבלת התעודות`
        );
        continue;
      }

      uploadedCertificates.push({ path, name: file.name });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        therapistId: therapist.id,
        uploadedCertificates,
        uploadWarnings,
      }),
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