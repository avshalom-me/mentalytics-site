import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { GUARANTEE_DAYS } from "./crm";

// The money-back guarantee tracker. A paying (Sumit-subscribed) therapist is
// entitled to a full refund if no patient inquiry ("פנייה") arrived within
// GUARANTEE_DAYS of their subscription start. This module answers: for every
// paid therapist whose window is open (or expired empty) - how many inquiries
// arrived, and how much time is left to act.
//
// An inquiry is counted as any row in therapist_contact_clicks inside the
// window (site messages, WhatsApp / phone / email clicks) - matching the
// public definition on the plan-choice page.
//
// Window anchor: therapists.promoted_since (set when the paid promotion
// began), falling back to the subscription's created_at.

export type GuaranteeRisk = "expired_no_contact" | "at_risk" | "watch" | "ok";

export type GuaranteeRow = {
  therapist_id: string;
  full_name: string;
  email: string;
  window_start: string;
  window_end: string;
  days_left: number; // negative → window already closed
  contacts_in_window: number;
  // פילוח סוג הפנייה בתוך החלון. ההבחנה העסקית (כמו במשפך ה-SEO): הודעה
  // שנשלחה דרך האתר היא פנייה *ודאית* - הטקסט שמור אצלנו; לחיצת
  // וואטסאפ/טלפון/מייל היא *כוונה* בלבד ואינה מוכיחה ששיחה התקיימה.
  // נחוץ בדיוק בשיחת ההחזר, שבה המטפל טוען "לא קיבלתי כלום" מול מונה
  // שסופר לחיצות (16/8/26 - החזרת יכולת שאבדה עם עמוד "לחיצות").
  contacts_certain: number; // site_message בלבד
  contacts_by_type: Record<string, number>;
  risk: GuaranteeRisk;
};

const AT_RISK_DAYS_LEFT = 21;

export async function computeGuarantee(): Promise<GuaranteeRow[]> {
  const { data: paying, error: payingErr } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, promoted_since, created_at")
    .eq("status", "paying")
    .eq("promotion_source", "paid");
  if (payingErr) throw new Error(payingErr.message);
  if (!paying || paying.length === 0) return [];

  const ids = paying.map((t) => t.id);

  const { data: subs, error: subsErr } = await supabaseAdmin
    .from("subscriptions")
    .select("therapist_id, status, created_at, current_period_start")
    .in("therapist_id", ids);
  if (subsErr) throw new Error(subsErr.message);

  // Earliest subscription per therapist = the original signup, even if a
  // later row exists after a cancel/resubscribe.
  const firstSub = new Map<string, string>();
  for (const s of subs ?? []) {
    const prev = firstSub.get(s.therapist_id);
    if (!prev || s.created_at < prev) firstSub.set(s.therapist_id, s.created_at);
  }

  const windows = paying.map((t) => {
    const startIso: string = t.promoted_since ?? firstSub.get(t.id) ?? t.created_at;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + GUARANTEE_DAYS * 24 * 60 * 60 * 1000);
    return { t, start, end };
  });

  const minStart = windows.reduce(
    (min, w) => (w.start < min ? w.start : min),
    windows[0].start
  );

  const clicks = await fetchAllRows<{
    therapist_id: string;
    clicked_at: string;
    click_type: string | null;
  }>(() =>
    supabaseAdmin
      .from("therapist_contact_clicks")
      .select("therapist_id, clicked_at, click_type")
      .in("therapist_id", ids)
      .gte("clicked_at", minStart.toISOString())
  );

  // דלי אחד לכל מטפל, עם פענוח תאריך יחיד לכל לחיצה - במקום סריקה מלאה
  // של כל הלחיצות עבור כל מטפל (הטבלה גדלה, החלון לא חסום מלמטה).
  const clicksByTherapist = new Map<string, { at: number; type: string }[]>();
  for (const c of clicks) {
    const entry = { at: new Date(c.clicked_at).getTime(), type: c.click_type ?? "other" };
    const arr = clicksByTherapist.get(c.therapist_id);
    if (arr) arr.push(entry);
    else clicksByTherapist.set(c.therapist_id, [entry]);
  }

  const now = new Date();
  const rows: GuaranteeRow[] = windows.map(({ t, start, end }) => {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const inWindow = (clicksByTherapist.get(t.id) ?? []).filter(
      (c) => c.at >= startMs && c.at <= endMs
    );
    const byType: Record<string, number> = {};
    for (const c of inWindow) byType[c.type] = (byType[c.type] ?? 0) + 1;
    const contacts = inWindow.length;
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    let risk: GuaranteeRisk;
    if (contacts > 0) risk = "ok";
    else if (daysLeft < 0) risk = "expired_no_contact";
    else if (daysLeft <= AT_RISK_DAYS_LEFT) risk = "at_risk";
    else risk = "watch";

    return {
      therapist_id: t.id,
      full_name: t.full_name ?? "",
      email: t.email ?? "",
      window_start: start.toISOString(),
      window_end: end.toISOString(),
      days_left: daysLeft,
      contacts_in_window: contacts,
      contacts_certain: byType["site_message"] ?? 0,
      contacts_by_type: byType,
      risk,
    };
  });

  const order: Record<GuaranteeRisk, number> = {
    expired_no_contact: 0,
    at_risk: 1,
    watch: 2,
    ok: 3,
  };
  rows.sort((a, b) => order[a.risk] - order[b.risk] || a.days_left - b.days_left);
  return rows;
}
