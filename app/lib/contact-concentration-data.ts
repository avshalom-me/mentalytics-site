import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import {
  CONCENTRATION_WINDOW_DAYS,
  FREEZE_ACTION_TYPE,
  FREEZE_COOLDOWN_DAYS,
  type ConcContact,
} from "./contact-concentration";

// הנתונים לניתוח ריכוז הפניות (contact-concentration.ts): מי פנה למי בחלון,
// מה חיפש ואיפה, מי הוקפא לאחרונה, ומתי התחיל כל מנוי פעיל. קריאה בלבד.

type ViewContext = { treatment: string; regionGroup: string | null; ageBand: string | null; at: string };

export async function loadConcentrationInput(now = new Date()): Promise<{
  contacts: ConcContact[];
  lastPausedAt: Map<string, string>;
  paidSince: Map<string, string>;
}> {
  const sinceIso = new Date(now.getTime() - CONCENTRATION_WINDOW_DAYS * 86_400_000).toISOString();
  const pauseSinceIso = new Date(now.getTime() - FREEZE_COOLDOWN_DAYS * 86_400_000).toISOString();

  const [clicks, views, pauses, executed, subs] = await Promise.all([
    fetchAllRows<{ therapist_id: string; session_id: string | null; source: string | null; automated: boolean | null }>(
      () =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, session_id, source, automated")
          .gte("clicked_at", sinceIso)
    ),
    // מה המטופל חיפש, איפה ובאיזה גיל נשמר על הכניסה לפרופיל מתוך תוצאות
    // השאלון. יום מרווח לפני החלון: מי שמילא שאלון אתמול בלילה ופנה הבוקר.
    fetchAllRows<{
      therapist_id: string;
      session_id: string | null;
      viewer_treatment: string | null;
      viewer_region: string | null;
      viewer_age_band: string | null;
      viewed_at: string;
    }>(() =>
      supabaseAdmin
        .from("therapist_profile_views")
        .select("therapist_id, session_id, viewer_treatment, viewer_region, viewer_age_band, viewed_at")
        .not("viewer_treatment", "is", null)
        .not("session_id", "is", null)
        .gte("viewed_at", new Date(Date.parse(sinceIso) - 86_400_000).toISOString())
    ),
    // צינון ההקפאה משני מקורות, כדי שהקפאה שלא נרשמה ביומן (writeAudit לא
    // זורק על כישלון) לא תאפשר הקפאה חוזרת: יומן הביקורת, והצעות שבוצעו.
    fetchAllRows<{ therapist_id: string; created_at: string; after_state: Record<string, unknown> | null }>(() =>
      supabaseAdmin
        .from("therapist_audit_log")
        .select("therapist_id, created_at, after_state")
        .eq("action", "set_match_pause")
        .gte("created_at", pauseSinceIso)
    ),
    fetchAllRows<{ entity_id: string | null; status_changed_at: string | null }>(() =>
      supabaseAdmin
        .from("agent_actions")
        .select("entity_id, status_changed_at")
        .eq("action_type", FREEZE_ACTION_TYPE)
        .eq("status", "executed")
        .gte("status_changed_at", pauseSinceIso)
    ),
    // תחילת המנוי הפעיל - "60 יום מקידום ממומן" נמדד ממנה למשלמים.
    supabaseAdmin.from("subscriptions").select("therapist_id, created_at").eq("status", "active"),
  ]);
  // בלי זה אי אפשר לבדוק את כללי ההקפאה, ולכן לא ממשיכים בחצי מידע.
  if (subs.error) throw new Error(`קריאת המנויים נכשלה: ${subs.error.message}`);

  const byPair = new Map<string, ViewContext>();
  const bySession = new Map<string, ViewContext>();
  for (const v of views) {
    if (!v.session_id || !v.viewer_treatment) continue;
    const ctx: ViewContext = {
      treatment: v.viewer_treatment,
      regionGroup: v.viewer_region,
      ageBand: v.viewer_age_band,
      at: v.viewed_at,
    };
    const pairKey = `${v.therapist_id}|${v.session_id}`;
    const prevPair = byPair.get(pairKey);
    if (!prevPair || ctx.at > prevPair.at) byPair.set(pairKey, ctx);
    const prev = bySession.get(v.session_id);
    if (!prev || ctx.at > prev.at) bySession.set(v.session_id, ctx);
  }

  const contacts: ConcContact[] = [];
  for (const c of clicks) {
    // לחיצה שהדפדפן הצהיר עליה כאוטומטית אינה אדם.
    if (!c.session_id || c.automated === true) continue;
    const source = c.source ?? "";
    // ההקשר של המטפל הזה בסשן הזה - קיים כשהמטופל נכנס אליו מתוך תוצאות
    // השאלון. לחיצה ישר מכרטיס התוצאות (בלי כניסה לפרופיל) לוקחת את ההקשר
    // מהשאלון של אותו סשן; לחיצה מהמאגר או מפרופיל שהגיעו אליו בדרך אחרת
    // נשארת בלי הקשר, כי אין דרך לדעת מה המטופל חיפש שם.
    const ctx =
      byPair.get(`${c.therapist_id}|${c.session_id}`) ?? (source === "match" ? bySession.get(c.session_id) : undefined);
    contacts.push({
      therapistId: c.therapist_id,
      sessionId: c.session_id,
      source,
      treatment: ctx?.treatment ?? null,
      regionGroup: ctx?.regionGroup ?? null,
      ageBand: ctx?.ageBand ?? null,
    });
  }

  // רק הקפאה (לא שחרור): after_state.match_paused_until מלא.
  const lastPausedAt = new Map<string, string>();
  const notePause = (id: string | null, at: string | null) => {
    if (!id || !at) return;
    const prev = lastPausedAt.get(id);
    if (!prev || at > prev) lastPausedAt.set(id, at);
  };
  for (const p of pauses) if (p.after_state?.match_paused_until) notePause(p.therapist_id, p.created_at);
  for (const a of executed) notePause(a.entity_id, a.status_changed_at);

  // מנוי פעיל אחד לכל משלם/ת בפועל; אם יש יותר, המוקדם הוא תחילת התשלום.
  const paidSince = new Map<string, string>();
  for (const r of (subs.data ?? []) as { therapist_id: string; created_at: string }[]) {
    const prev = paidSince.get(r.therapist_id);
    if (!prev || r.created_at < prev) paidSince.set(r.therapist_id, r.created_at);
  }

  return { contacts, lastPausedAt, paidSince };
}
