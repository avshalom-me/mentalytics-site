import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { CONCENTRATION_WINDOW_DAYS, FREEZE_COOLDOWN_DAYS, type ConcContact } from "./contact-concentration";

// הנתונים לניתוח ריכוז הפניות (contact-concentration.ts): מי פנה למי בחלון,
// מה הוא חיפש, ומי הוקפא לאחרונה. קריאה בלבד.

export async function loadConcentrationInput(now = new Date()): Promise<{
  contacts: ConcContact[];
  lastPausedAt: Map<string, string>;
}> {
  const sinceIso = new Date(now.getTime() - CONCENTRATION_WINDOW_DAYS * 86_400_000).toISOString();
  const pauseSinceIso = new Date(now.getTime() - FREEZE_COOLDOWN_DAYS * 86_400_000).toISOString();

  const [clicks, views, pauses] = await Promise.all([
    fetchAllRows<{ therapist_id: string; session_id: string | null; source: string | null; automated: boolean | null }>(
      () =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, session_id, source, automated")
          .gte("clicked_at", sinceIso)
    ),
    // הטיפול שהמטופל חיפש נשמר על הצפיות שמגיעות מהשאלון (כרטיס או כניסה
    // לפרופיל). יום מרווח לפני החלון: מי שמילא שאלון אתמול בלילה ופנה הבוקר.
    fetchAllRows<{ therapist_id: string; session_id: string | null; viewer_treatment: string | null; viewed_at: string }>(
      () =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, session_id, viewer_treatment, viewed_at")
          .not("viewer_treatment", "is", null)
          .not("session_id", "is", null)
          .gte("viewed_at", new Date(Date.parse(sinceIso) - 86_400_000).toISOString())
    ),
    supabaseAdmin
      .from("therapist_audit_log")
      .select("therapist_id, created_at, after_state")
      .eq("action", "set_match_pause")
      .gte("created_at", pauseSinceIso),
  ]);
  if (pauses.error) throw new Error(`קריאת ההקפאות האחרונות נכשלה: ${pauses.error.message}`);

  // הטיפול של מטפל × סשן, ובנפילה - הטיפול האחרון שהסשן חיפש בכלל (מי שמילא
  // שאלון ואחר כך פנה מהמאגר חיפש את אותו דבר).
  const byPair = new Map<string, string>();
  const bySession = new Map<string, { treatment: string; at: string }>();
  for (const v of views) {
    if (!v.session_id || !v.viewer_treatment) continue;
    byPair.set(`${v.therapist_id}|${v.session_id}`, v.viewer_treatment);
    const prev = bySession.get(v.session_id);
    if (!prev || v.viewed_at > prev.at) bySession.set(v.session_id, { treatment: v.viewer_treatment, at: v.viewed_at });
  }

  const contacts: ConcContact[] = [];
  for (const c of clicks) {
    // לחיצה שהדפדפן הצהיר עליה כאוטומטית אינה אדם.
    if (!c.session_id || c.automated === true) continue;
    contacts.push({
      therapistId: c.therapist_id,
      sessionId: c.session_id,
      source: c.source ?? "",
      treatment: byPair.get(`${c.therapist_id}|${c.session_id}`) ?? bySession.get(c.session_id)?.treatment ?? null,
    });
  }

  // רק הקפאה (לא שחרור): after_state.match_paused_until מלא.
  const lastPausedAt = new Map<string, string>();
  for (const p of (pauses.data ?? []) as { therapist_id: string; created_at: string; after_state: Record<string, unknown> | null }[]) {
    if (!p.after_state?.match_paused_until) continue;
    const prev = lastPausedAt.get(p.therapist_id);
    if (!prev || p.created_at > prev) lastPausedAt.set(p.therapist_id, p.created_at);
  }

  return { contacts, lastPausedAt };
}
