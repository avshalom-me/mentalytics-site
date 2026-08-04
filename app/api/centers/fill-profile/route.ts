import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { writeAudit } from "@/app/lib/audit";
import { CENTER_THERAPIST_EDIT_FIELDS, sanitizePublicationLinks } from "@/app/lib/therapist-fields";

// מילוי פרופיל מטפל לפי הזמנת מרכז (מסלול 1) - אימות בטוקן ההזמנה האישי,
// בלי חשבון. JSON = יצירת הפרופיל (חד-פעמי); multipart = העלאת תמונה/תעודה
// לפרופיל שנוצר מאותה הזמנה. הפרופיל שייך למרכז (user_id ריק) ונכנס לתור
// האישורים הרגיל של האדמין.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

type Invite = { id: string; center_account_id: string; email: string; used_at: string | null; therapist_id: string | null };

async function loadInvite(token: string): Promise<Invite | null> {
  if (!token || token.length > 100) return null;
  const { data } = await supabaseAdmin
    .from("center_therapist_invites")
    .select("id, center_account_id, email, used_at, therapist_id")
    .eq("token", token)
    .maybeSingle();
  return (data as Invite | null) ?? null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ── העלאת קובץ (תמונה/תעודה) לפרופיל שכבר נוצר מההזמנה ──────────────────
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const token = String(fd.get("token") ?? "");
      const type = String(fd.get("type") ?? "");
      const file = fd.get("file") as File | null;
      const invite = await loadInvite(token);
      if (!invite) return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });
      if (!invite.therapist_id) return NextResponse.json({ ok: false, error: "יש לשמור קודם את הפרופיל" }, { status: 400 });
      // ההעלאות קורות מיד אחרי שמירת הטופס (שמסמנת used_at) - חלון של שעה
      // מספיק לזרימה האמיתית, וסוגר שימוש-חוזר בקישור שהועבר הלאה חודשים
      // אחרי (החלפת תמונה של פרופיל חי בלי אישור מחדש).
      if (invite.used_at && Date.now() - new Date(invite.used_at).getTime() > 60 * 60_000) {
        return NextResponse.json({ ok: false, error: "חלון ההעלאה מהקישור הזה נסגר - לעדכונים פנו למנהל/ת המרכז" }, { status: 403 });
      }
      if (!file || (type !== "photo" && type !== "certificate")) {
        return NextResponse.json({ ok: false, error: "Missing file or type" }, { status: 400 });
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
      }

      if (type === "photo") {
        let out: Buffer;
        try {
          out = await sharp(Buffer.from(await file.arrayBuffer()))
            .rotate().resize(600, 600, { fit: "cover", position: "center" }).webp({ quality: 80 }).toBuffer();
        } catch {
          return NextResponse.json({ ok: false, error: "Invalid image" }, { status: 400 });
        }
        const path = `photos/invite-${invite.therapist_id}-${Date.now()}.webp`;
        const { error } = await supabaseAdmin.storage.from("therapist-certificates")
          .upload(path, out, { contentType: "image/webp", upsert: true });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        await supabaseAdmin.from("therapists")
          .update({ profile_photo_path: path, profile_updated_at: new Date().toISOString() })
          .eq("id", invite.therapist_id);
        return NextResponse.json({ ok: true });
      }

      // תעודה
      const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
      if ((file.type && !ALLOWED_TYPES.includes(file.type)) || !["pdf", "jpg", "jpeg", "png"].includes(ext)) {
        return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך - PDF / JPG / PNG בלבד" }, { status: 400 });
      }
      const path = `certificates/invite-${invite.therapist_id}-${Date.now()}.${ext}`;
      const { error } = await supabaseAdmin.storage.from("therapist-certificates")
        .upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: true });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      await supabaseAdmin.from("therapist_certificates").insert({
        therapist_id: invite.therapist_id,
        file_path: path,
        original_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
      return NextResponse.json({ ok: true });
    }

    // ── יצירת הפרופיל (JSON, חד-פעמי לכל הזמנה) ────────────────────────────
    const body = (await req.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const invite = await loadInvite(token);
    if (!invite) return NextResponse.json({ ok: false, error: "הקישור אינו תקף - בקשו מהמרכז הזמנה חדשה" }, { status: 404 });
    if (invite.used_at) {
      return NextResponse.json({ ok: false, error: "הפרופיל מהקישור הזה כבר מולא. לעדכונים פנו למנהל/ת המרכז." }, { status: 409 });
    }

    // המרכז חייב להיות פעיל (ההזמנות נשלחות רק ממרכז פעיל, אבל ייתכן ביטול בינתיים).
    const { data: center } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("id, name, status")
      .eq("id", invite.center_account_id)
      .maybeSingle();
    if (!center || center.status !== "active") {
      return NextResponse.json({ ok: false, error: "המנוי של המרכז אינו פעיל - פנו למנהל/ת המרכז" }, { status: 403 });
    }

    // אותה רשימת שדות מותרת כמו בעריכת מטפל ע"י המרכז - מקור אמת אחד.
    const fields: Record<string, unknown> = {};
    for (const key of CENTER_THERAPIST_EDIT_FIELDS) {
      if (key in body) fields[key] = body[key];
    }
    // סניטציה כמו בכל נתיבי הכתיבה - הקישורים מרונדרים כעוגנים בעמוד הציבורי.
    if ("publication_links" in fields) fields.publication_links = sanitizePublicationLinks(fields.publication_links);
    if (Array.isArray(fields.regions) && fields.regions.length > 15) fields.regions = (fields.regions as unknown[]).slice(0, 15);
    const fullName = typeof fields.full_name === "string" ? fields.full_name.trim() : "";
    if (!fullName) return NextResponse.json({ ok: false, error: "חסר שם מלא" }, { status: 400 });

    const { data: created, error: insErr } = await supabaseAdmin
      .from("therapists")
      .insert({
        ...fields,
        full_name: fullName,
        email: (typeof fields.email === "string" && fields.email.trim()) || invite.email,
        gender: typeof fields.gender === "string" ? fields.gender : "",
        center_account_id: invite.center_account_id,
        user_id: null, // בבעלות המרכז - למטפל אין חשבון
        status: "pending",
        tier: "free",
        profile_updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !created) {
      console.error(`centers/fill-profile insert failed (invite=${invite.id}):`, insErr?.message);
      return NextResponse.json({ ok: false, error: "שמירת הפרופיל נכשלה - נסו שוב" }, { status: 500 });
    }

    // סימון ההזמנה כמומשה - מגן מרוץ: רק אם עדיין לא מומשה.
    const { data: marked } = await supabaseAdmin
      .from("center_therapist_invites")
      .update({ used_at: new Date().toISOString(), therapist_id: created.id })
      .eq("id", invite.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!marked) {
      // מרוץ נדיר: מילוי כפול במקביל - מוחקים את הפרופיל השני.
      await supabaseAdmin.from("therapists").delete().eq("id", created.id);
      return NextResponse.json({ ok: false, error: "הפרופיל מהקישור הזה כבר מולא" }, { status: 409 });
    }

    await writeAudit(supabaseAdmin, {
      therapistId: created.id,
      actorType: "center",
      actorId: invite.center_account_id,
      action: "invite_fill_profile",
      before: {},
      after: { full_name: fullName, invite_email: invite.email },
      reason: `profile self-filled from center invite (${center.name})`,
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("centers/fill-profile error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}
