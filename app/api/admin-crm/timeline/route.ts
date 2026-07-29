import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Unified 360° timeline for a therapist: audit log (status changes,
// promotions, subscription events), outbound emails, internal notes,
// inquiries (leads), contact clicks, subscription payments, registration.
// Everything already exists in separate tables — this merges and sorts.

export type TimelineEvent = {
  kind: "audit" | "email" | "note" | "lead" | "click" | "payment" | "registered";
  ts: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  approve: "אושר לפרסום",
  approve_listing: "אושר לפרסום (משלם)",
  reject: "נדחה",
  promote: "קודם למסלול בתשלום",
  gift: "קיבל קידום במתנה",
  demote: "הוסר מהמסלול בתשלום",
  return_to_pending: "הוחזר להמתנה",
  request_completion: "נשלחה בקשת השלמת פרופיל",
  send_message: "נשלחה הודעה מהאדמין",
  subscription_created: "נפתח מנוי",
  subscription_cancelled: "מנוי בוטל",
  trial_expired: "תקופת ניסיון הסתיימה",
  profile_update: "הפרופיל עודכן",
  delete_cert: "נמחקה תעודה",
};

function auditTitle(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const ACTOR_LABELS: Record<string, string> = {
  admin: "אדמין",
  self: "המטפל/ת",
  sumit: "Sumit",
  cron: "אוטומטי",
  system: "מערכת",
};

const CLICK_LABELS: Record<string, string> = {
  whatsapp: "לחיצת וואטסאפ",
  phone: "לחיצת טלפון",
  email: "לחיצת מייל",
  site_message: "הודעה דרך האתר",
};

export async function GET(req: NextRequest) {
  const therapistId = req.nextUrl.searchParams.get("therapist_id");
  if (!therapistId) {
    return NextResponse.json({ ok: false, error: "חסר therapist_id" }, { status: 400 });
  }

  // Therapist first — the email log is keyed by recipient address, so we need
  // their email before querying it.
  const { data: therapistRow, error: therapistErr } = await supabaseAdmin
    .from("therapists")
    .select("email, created_at, signup_channel, signup_utm_campaign")
    .eq("id", therapistId)
    .maybeSingle();
  if (therapistErr || !therapistRow) {
    return NextResponse.json({ ok: false, error: "מטפל לא נמצא" }, { status: 404 });
  }

  const [audit, emails, notes, leads, clicks, payments] = await Promise.all([
    supabaseAdmin
      .from("therapist_audit_log")
      .select("action, actor_type, reason, created_at")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(200),
    therapistRow.email
      ? supabaseAdmin
          .from("crm_email_log")
          .select("subject, template, sent_by, status, created_at")
          .eq("recipient", therapistRow.email)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as { subject: string | null; template: string | null; sent_by: string; status: string; created_at: string }[] }),
    supabaseAdmin
      .from("crm_notes")
      .select("body, author, created_at")
      .eq("entity_type", "therapist")
      .eq("entity_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("crm_leads")
      .select("name, contact, message, status, created_at")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("therapist_contact_clicks")
      .select("click_type, source, clicked_at")
      .eq("therapist_id", therapistId)
      .order("clicked_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("payments")
      .select("amount, status, created_at")
      .eq("payment_type", "subscription")
      .eq("reference_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const events: TimelineEvent[] = [];

  for (const a of audit.data ?? []) {
    events.push({
      kind: "audit",
      ts: a.created_at,
      title: auditTitle(a.action),
      detail: a.reason ?? null,
      actor: ACTOR_LABELS[a.actor_type] ?? a.actor_type,
    });
  }
  for (const e of emails.data ?? []) {
    events.push({
      kind: "email",
      ts: e.created_at,
      title: e.status === "failed" ? "שליחת מייל נכשלה" : "נשלח מייל",
      detail: e.subject ?? e.template ?? null,
      actor: e.sent_by,
    });
  }
  for (const n of notes.data ?? []) {
    events.push({
      kind: "note",
      ts: n.created_at,
      title: "הערה פנימית",
      detail: n.body,
      actor: n.author,
    });
  }
  for (const l of leads.data ?? []) {
    events.push({
      kind: "lead",
      ts: l.created_at,
      title: "התקבלה פנייה דרך האתר",
      detail: l.name ? `${l.name} · ${l.contact ?? ""}` : l.contact ?? null,
      actor: null,
    });
  }
  for (const c of clicks.data ?? []) {
    // site_message clicks are already represented (with content) by the lead
    // rows above — skip the bare click so the timeline doesn't double-count.
    if (c.click_type === "site_message") continue;
    events.push({
      kind: "click",
      ts: c.clicked_at,
      title: CLICK_LABELS[c.click_type] ?? `לחיצה (${c.click_type})`,
      detail:
        c.source === "match"
          ? "מתוך התאמה"
          : c.source === "directory"
            ? "מהמאגר"
            : c.source === "profile"
              ? "מדף הפרופיל"
              : c.source,
      actor: null,
    });
  }
  for (const p of payments.data ?? []) {
    events.push({
      kind: "payment",
      ts: p.created_at,
      title:
        p.status === "completed"
          ? `חיוב מנוי נקלט (₪${p.amount})`
          : p.status === "failed"
            ? `חיוב מנוי נכשל (₪${p.amount})`
            : `חיוב מנוי בתהליך (₪${p.amount})`,
      detail: null,
      actor: "Sumit",
    });
  }
  if (therapistRow.created_at) {
    events.push({
      kind: "registered",
      ts: therapistRow.created_at,
      title: "נרשם/ה למערכת",
      detail:
        therapistRow.signup_utm_campaign
          ? `קמפיין: ${therapistRow.signup_utm_campaign}`
          : therapistRow.signup_channel
            ? `ערוץ: ${therapistRow.signup_channel}`
            : null,
      actor: null,
    });
  }

  events.sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return NextResponse.json({ ok: true, events: events.slice(0, 300) });
}
