import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { resolveCenter } from "@/app/lib/center-auth";
import { sendCenterTherapistInviteEmail } from "@/app/lib/center-emails";

// הזמנות מטפלים ע"י מנהל המרכז (מסלול 1): המנהל מזין מיילים, כל מטפל מקבל
// קישור אישי (/centers/fill/<token>) וממלא את הפרופיל שלו בעצמו. הפרופיל
// שנוצר משויך למרכז ונכנס לתור האישורים הרגיל. המכסה נאכפת כאן: פרופילים
// מקושרים + הזמנות פתוחות ≤ מספר המטפלים שבמנוי.

export const dynamic = "force-dynamic";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("center_therapist_invites")
    .select("id, email, invited_at, used_at, therapist_id")
    .eq("center_account_id", center.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ ok: true, invites: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות — נסו שוב בעוד רגע" }, { status: 429 });
  }

  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (center.status !== "active") {
    return NextResponse.json({ ok: false, error: "המנוי של המרכז אינו פעיל" }, { status: 403 });
  }
  if ((center.billing_track as string) === "center_entity") {
    return NextResponse.json({ ok: false, error: "במסלול 'מרכז כישות אחת' אין פרופילי מטפלים בודדים" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "invite") {
      const raw = Array.isArray(body.emails) ? body.emails : [];
      const emails = [...new Set(
        raw.map((e) => (typeof e === "string" ? e.trim().toLowerCase() : "")).filter((e) => EMAIL_RE.test(e)),
      )].slice(0, 30);
      if (emails.length === 0) {
        return NextResponse.json({ ok: false, error: "לא זוהו כתובות מייל תקינות" }, { status: 400 });
      }

      // מכסה: פרופילים מקושרים (ללא ישות) + הזמנות פתוחות + החדשות ≤ המנוי.
      const quota = Math.floor(Number(center.therapist_count) || 0);
      const [{ count: linked }, { data: existing }] = await Promise.all([
        supabaseAdmin.from("therapists")
          .select("id", { count: "exact", head: true })
          .eq("center_account_id", center.id)
          .neq("entity_type", "center"),
        supabaseAdmin.from("center_therapist_invites")
          .select("id, email, used_at")
          .eq("center_account_id", center.id),
      ]);
      const openInvites = (existing ?? []).filter((i) => !i.used_at);
      const alreadyInvited = new Set(openInvites.map((i) => i.email.toLowerCase()));
      const fresh = emails.filter((e) => !alreadyInvited.has(e));
      if (fresh.length === 0) {
        return NextResponse.json({ ok: false, error: "כל הכתובות האלה כבר הוזמנו וממתינות למילוי" }, { status: 400 });
      }
      if (quota > 0 && (linked ?? 0) + openInvites.length + fresh.length > quota) {
        const room = Math.max(0, quota - (linked ?? 0) - openInvites.length);
        return NextResponse.json(
          { ok: false, error: `המנוי כולל ${quota} מטפלים — נותר מקום ל-${room} הזמנות. להרחבה: admin@getmentalytics.com` },
          { status: 400 },
        );
      }

      const { data: created, error: insErr } = await supabaseAdmin
        .from("center_therapist_invites")
        .insert(fresh.map((email) => ({ center_account_id: center.id, email })))
        .select("id, email, token");
      if (insErr || !created) throw insErr ?? new Error("insert failed");

      // שליחה סדרתית — כשל במייל בודד לא מפיל את השאר.
      const failures: string[] = [];
      for (const inv of created) {
        const r = await sendCenterTherapistInviteEmail({ to: inv.email, centerName: center.name, token: inv.token });
        if (!r.ok) failures.push(inv.email);
      }
      return NextResponse.json({ ok: true, sent: created.length - failures.length, failed: failures });
    }

    if (action === "resend" || action === "revoke") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
      const { data: invite } = await supabaseAdmin
        .from("center_therapist_invites")
        .select("id, email, token, used_at")
        .eq("id", id)
        .eq("center_account_id", center.id) // בעלות
        .maybeSingle();
      if (!invite) return NextResponse.json({ ok: false, error: "ההזמנה לא נמצאה" }, { status: 404 });
      if (invite.used_at) return NextResponse.json({ ok: false, error: "הפרופיל כבר מולא מההזמנה הזו" }, { status: 400 });

      if (action === "revoke") {
        await supabaseAdmin.from("center_therapist_invites").delete().eq("id", invite.id);
        return NextResponse.json({ ok: true });
      }
      const r = await sendCenterTherapistInviteEmail({ to: invite.email, centerName: center.name, token: invite.token });
      return r.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ ok: false, error: "שליחת המייל נכשלה — נסו שוב" }, { status: 502 });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("center-portal/invites error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}
