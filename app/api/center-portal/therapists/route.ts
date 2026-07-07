import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { resolveCenter } from "@/app/lib/center-auth";
import { writeAudit } from "@/app/lib/audit";
import { promoteCenterTherapists } from "@/app/lib/center-promotion";

// ניהול פרופילי מטפלים על-ידי המרכז, מתוך הפורטל. פרופיל שנוצר כאן שייך
// למרכז (center_account_id מוגדר, user_id ריק) — רק מנהלי המרכז עורכים אותו,
// למטפל הבודד אין חשבון ואין גישה. הפרופיל נכנס לתור האישורים הרגיל של
// האדמין (status='pending'), ועם האישור — אם מנוי המרכז פעיל — הוא מקודם
// אוטומטית למערכת ההתאמות (promotion_source='center').

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// אותם שדות שהמטפל עצמו רשאי לערוך (therapist-profile PATCH) — מקור אחד לאמת
// היה עדיף, אבל הרשימה יציבה ומוגדרת גם שם כקבוע מקומי.
const ALLOWED_FIELDS = [
  "full_name", "email", "phone", "bio", "gender", "online",
  "therapist_types", "training_areas", "assessment_types",
  "couples_modalities", "cogfun_age_groups",
  "regions", "cultural_prefs", "arrangements", "age_groups", "languages",
  "style_q1", "style_q2", "activity_level",
  "education", "experience",
] as const;

function pickAllowed(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key];
  }
  return update;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות — נסו שוב בעוד רגע" }, { status: 429 });
  }

  const center = await resolveCenter(req);
  if (!center) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (center.status !== "active") {
    return NextResponse.json({ ok: false, error: "המנוי של המרכז אינו פעיל" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "create") {
      const fields = pickAllowed(body);
      const fullName = typeof fields.full_name === "string" ? fields.full_name.trim() : "";
      if (!fullName) {
        return NextResponse.json({ ok: false, error: "חסר שם המטפל/ת" }, { status: 400 });
      }

      // אכיפת המכסה: המרכז משלם לפי therapist_count.
      const quota = Math.floor(Number(center.therapist_count) || 0);
      const { count: linkedNow } = await supabaseAdmin
        .from("therapists")
        .select("id", { count: "exact", head: true })
        .eq("center_account_id", center.id);
      if (quota > 0 && (linkedNow ?? 0) >= quota) {
        return NextResponse.json(
          { ok: false, error: `המנוי שלכם כולל ${quota} מטפלים וכולם בשימוש. להוספת מטפל/ת נוסף/ת פנו אלינו — admin@getmentalytics.com` },
          { status: 400 },
        );
      }

      const { data: created, error } = await supabaseAdmin
        .from("therapists")
        .insert({
          ...fields,
          full_name: fullName,
          gender: typeof fields.gender === "string" ? fields.gender : "", // NOT NULL בסכימה
          center_account_id: center.id,
          user_id: null, // פרופיל בבעלות המרכז — אין חשבון למטפל הבודד
          status: "pending", // תור האישורים הרגיל של האדמין
          tier: "free",
          profile_updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !created) {
        console.error(`center-portal/therapists create failed (center=${center.id}):`, error?.message);
        return NextResponse.json({ ok: false, error: "יצירת הפרופיל נכשלה" }, { status: 500 });
      }

      await writeAudit(supabaseAdmin, {
        therapistId: created.id,
        actorType: "center",
        actorId: center.id,
        action: "center_create_profile",
        before: {},
        after: { full_name: fullName },
        reason: `profile created from center portal (${center.name})`,
      });

      return NextResponse.json({ ok: true, id: created.id, created: true });
    }

    if (action === "update") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

      // בעלות: מותר לערוך רק מטפל שמשויך למרכז הזה.
      const { data: existing } = await supabaseAdmin
        .from("therapists")
        .select("id, status, center_account_id")
        .eq("id", id)
        .maybeSingle();
      if (!existing || existing.center_account_id !== center.id) {
        return NextResponse.json({ ok: false, error: "המטפל/ת אינו/ה משויך/ת למרכז שלכם" }, { status: 404 });
      }

      const update = pickAllowed(body);
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ ok: false, error: "אין שדות לעדכון" }, { status: 400 });
      }
      if ("full_name" in update && !(typeof update.full_name === "string" && update.full_name.trim())) {
        return NextResponse.json({ ok: false, error: "שם המטפל/ת לא יכול להיות ריק" }, { status: 400 });
      }
      update.profile_updated_at = new Date().toISOString();

      // עריכה של פרופיל שנדחה = הגשה מחדש לבדיקה (כמו בעריכה עצמית של מטפל).
      if (existing.status === "rejected") {
        update.status = "pending";
        update.rejection_reason = null;
      }

      const { error } = await supabaseAdmin.from("therapists").update(update).eq("id", id);
      if (error) {
        console.error(`center-portal/therapists update failed (center=${center.id}, therapist=${id}):`, error.message);
        return NextResponse.json({ ok: false, error: "העדכון נכשל" }, { status: 500 });
      }

      await writeAudit(supabaseAdmin, {
        therapistId: id,
        actorType: "center",
        actorId: center.id,
        action: "center_update_profile",
        before: { status: existing.status },
        after: { fields: Object.keys(update) },
        reason: `profile updated from center portal (${center.name})`,
      });

      // אם הפרופיל כבר מאושר והמרכז פעיל — לוודא שהקידום במקום (למשל אחרי
      // שנדחה, תוקן ואושר מחדש בינתיים). שקט כשאין מה לעשות.
      await promoteCenterTherapists(center.id);

      return NextResponse.json({ ok: true, id });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("center-portal/therapists error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}

// שליפת פרופיל מלא לעריכה בפורטל (כולל URL חתום לתמונה ותעודות קיימות).
export async function GET(req: NextRequest) {
  const center = await resolveCenter(req);
  if (!center) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("*")
    .eq("id", id)
    .eq("center_account_id", center.id)
    .maybeSingle();
  if (!therapist) {
    return NextResponse.json({ ok: false, error: "המטפל/ת אינו/ה משויך/ת למרכז שלכם" }, { status: 404 });
  }

  let photoUrl: string | null = null;
  if (therapist.profile_photo_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from("therapist-certificates")
      .createSignedUrl(therapist.profile_photo_path, 60 * 60 * 24);
    if (signed?.signedUrl) photoUrl = signed.signedUrl;
  }

  const { data: certRows } = await supabaseAdmin
    .from("therapist_certificates")
    .select("id, file_path, original_name, created_at")
    .eq("therapist_id", id)
    .order("created_at", { ascending: true });
  const certificates = await Promise.all(
    (certRows ?? []).map(async (c) => {
      const { data: signed } = await supabaseAdmin.storage
        .from("therapist-certificates")
        .createSignedUrl(c.file_path, 60 * 60 * 24);
      return { id: c.id, original_name: c.original_name ?? "תעודה", signed_url: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ ok: true, therapist, photoUrl, certificates });
}
