import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { runDailyDigest } from "@/app/lib/daily-digest";
import { runWatchdog } from "@/app/lib/watchdog";
import { runConversionsSync, setupConversionActions } from "@/app/lib/google-ads-conversions";
import { googleAdsConfigured } from "@/app/lib/google-ads";
import { runAdsMonitor } from "@/app/lib/ads-monitor";
import { runSupplyGaps } from "@/app/lib/supply-gaps";
import { runFinanceRecon } from "@/app/lib/finance-recon";
import { runRetention } from "@/app/lib/retention";
import { sendGiftOffer } from "@/app/lib/gift-offer";

// ה-API של עמוד הסוכנים: יומן ריצות, תור ההצעות, והפעלת תצוגה מקדימה של
// דוח הבוקר. מוגן אוטומטית ב-Basic Auth דרך ה-middleware (קידומת /api/admin-).

export const dynamic = "force-dynamic";
// 300 ולא 120: הרצת שומר הלילה הידנית יכולה להימשך עד ~35 שניות בריצה
// מקבילה, אבל בתרחיש תקלה כוללת עם ניסיונות חוזרים אסור שוורסל יהרוג את
// הפונקציה לפני שהריצה נרשמת (ממצא ביקורת: ריצה שנהרגה נשארת "רץ..." לנצח).
export const maxDuration = 300;

export async function GET() {
  try {
    const [runsRes, pendingRes, actionCountRes, findingCountRes, resolvedRes, latestDigestRes] =
      await Promise.all([
      supabaseAdmin
        .from("agent_runs")
        .select("id, agent, started_at, finished_at, status, mode, summary, error")
        .order("started_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("agent_actions")
        // payload נשלח לעמוד כי הצעת המתנה נערכת שם לפני השליחה (המועמדים
        // והטיוטה האישית לכל אחד יושבים בו).
        .select("id, agent, action_type, kind, title, body, entity_type, entity_id, entity_label, payload, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        // 200 ולא 50: העמוד מקבץ את התור לפי סוג ומקפל את החלק המידעי, ולכן
        // הוא סופג כמות כזו. עם 50 בלבד הכותרת ספרה את מה שהוחזר, ודחייה
        // אחת רק שאבה שורה חדשה פנימה - המספר נראה תקוע.
        .limit(200),
      // שתי ספירות אמיתיות מהמאגר, לא אורך הרשימה שהוחזרה: פעולות שדורשות
      // אותך, וממצאים לידיעה. ההפרדה מגיעה מעמודת kind שהסוכן מילא.
      supabaseAdmin
        .from("agent_actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("kind", "action"),
      supabaseAdmin
        .from("agent_actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("kind", "finding"),
      supabaseAdmin
        .from("agent_actions")
        .select("id, agent, title, status, status_changed_at")
        .neq("status", "pending")
        .order("status_changed_at", { ascending: false })
        .limit(10),
      // הדוח האחרון של בקר הבוקר, כולל תוכנו המלא (details) - כך העמוד מציג
      // אותו ישירות בלי מייל ובלי להריץ מחדש (החלטת המשתמש 16/8).
      supabaseAdmin
        .from("agent_runs")
        .select("started_at, mode, status, details")
        .eq("agent", "daily_digest")
        .in("status", ["ok", "empty"])
        .order("started_at", { ascending: false })
        .limit(1),
    ]);

    const latestDigestRun = latestDigestRes.data?.[0] ?? null;
    const digestDetails = (latestDigestRun?.details ?? null) as {
      sections?: unknown[];
      ai_summary?: string | null;
    } | null;

    return NextResponse.json({
      ok: true,
      runs: runsRes.data ?? [],
      pending_actions: pendingRes.data ?? [],
      // הספירות האמיתיות מהמאגר, מופרדות לפי סוג התוצר.
      pending_action_total: actionCountRes.count ?? 0,
      pending_finding_total: findingCountRes.count ?? 0,
      pending_total: (actionCountRes.count ?? 0) + (findingCountRes.count ?? 0),
      resolved_actions: resolvedRes.data ?? [],
      latest_digest: latestDigestRun
        ? {
            started_at: latestDigestRun.started_at,
            status: latestDigestRun.status,
            sections: digestDetails?.sections ?? [],
            ai_summary: digestDetails?.ai_summary ?? null,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// הפעלה ידנית מהאדמין - תמיד תצוגה מקדימה, אף פעם לא שליחה. השליחה
// האמיתית שמורה לקרון החמוש בלבד, כדי שלא יהיו שני מסלולי שליחה.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "digest_preview") {
      const result = await runDailyDigest({ send: false });
      return NextResponse.json({
        ok: result.ok,
        empty: result.empty,
        sections: result.sections,
        ai_summary: result.aiSummary,
        html: result.html,
        recipients: result.recipients,
        error: result.error,
      });
    }
    if (body?.action === "watchdog_run") {
      const result = await runWatchdog({ send: false });
      return NextResponse.json({
        ok: result.ok,
        checks: result.checks,
        failures: result.failures.length,
        error: result.error,
      });
    }
    if (body?.action === "supply_gaps_run") {
      const result = await runSupplyGaps();
      return NextResponse.json({
        ok: result.ok,
        gift_gaps: result.giftGaps,
        recruit_gaps: result.recruitGaps,
        waiting_gaps: result.waitingGaps,
        error: result.error,
      });
    }
    // שליחת הצעת מתנה: מסלול השליחה היחיד, ורק מקליק מפורש באדמין. המייל
    // יוצא כאן ורק כאן - אין קרון ואין מסלול אוטומטי שמריץ את זה.
    if (body?.action === "gift_offer_send") {
      const actionId = String(body?.id ?? "");
      const therapistId = String(body?.therapist_id ?? "");
      const subject = String(body?.subject ?? "");
      const draft = String(body?.body ?? "");
      if (!actionId || !therapistId || !draft.trim()) {
        return NextResponse.json(
          { ok: false, error: "חסרים פרטים: הצעה, נמען או גוף המייל" },
          { status: 400 }
        );
      }
      const result = await sendGiftOffer({ actionId, therapistId, subject, body: draft });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        therapist_name: result.therapistName,
        email: result.email,
      });
    }
    if (body?.action === "retention_run") {
      const result = await runRetention();
      return NextResponse.json({
        ok: result.ok,
        findings: result.findings,
        checked: result.checked,
        error: result.error,
      });
    }
    if (body?.action === "finance_run") {
      const result = await runFinanceRecon();
      return NextResponse.json({
        ok: result.ok,
        findings: result.findings,
        checked: result.checked,
        error: result.error,
      });
    }
    if (body?.action === "ads_run") {
      const result = await runAdsMonitor();
      return NextResponse.json({
        ok: result.ok,
        configured: result.configured,
        findings: result.findings,
        campaigns: result.campaigns,
        spend_mtd: result.spendMtd,
        budget_pace: result.budgetPace,
        error: result.error,
      });
    }
    if (body?.action === "conversions_preview") {
      const result = await runConversionsSync({ send: false });
      return NextResponse.json({
        ok: result.ok,
        configured: result.configured,
        actions: result.actions,
        actions_ready: result.actionsReady,
        pending: result.pending,
        error: result.error,
      });
    }
    // הקמה חד-פעמית של פעולות ההמרה בחשבון גוגל - כתיבה יחידה, מופעלת רק
    // מקליק מפורש בכפתור ייעודי (עם אישור) בעמוד הסוכנים.
    if (body?.action === "conversions_setup") {
      if (!googleAdsConfigured()) {
        return NextResponse.json(
          { ok: false, error: "חיבור Google Ads לא מוגדר בסביבה הזו" },
          { status: 400 }
        );
      }
      const actions = await setupConversionActions();
      return NextResponse.json({
        ok: true,
        actions,
        actions_ready: Boolean(actions.quiz && actions.subscription),
      });
    }
    return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const status = String(body?.status ?? "");

    // הכרעה קבוצתית: התור מתמלא בממצאים מידעיים (פערי גיוס, התראות), ואין
    // טעם לדחות 43 שורות אחת-אחת. רק דחייה מותרת בקבוצה - אישור קבוצתי של
    // הצעות שמובילות לפעולה הוא בדיוק מה שלא רוצים שיקרה בקליק אחד.
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: unknown) => String(x)).filter(Boolean) : [];
    if (ids.length > 0) {
      if (status !== "dismissed") {
        return NextResponse.json({ ok: false, error: "הכרעה קבוצתית אפשרית רק לדחייה" }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("agent_actions")
        .update({
          status: "dismissed",
          status_changed_at: new Date().toISOString(),
          resolved_by: "admin",
          resolution_note: body?.note ? String(body.note) : "נדחה בהכרעה קבוצתית",
        })
        .in("id", ids)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, dismissed: data?.length ?? 0 });
    }

    const id = String(body?.id ?? "");
    if (!id || !["approved", "dismissed", "pending"].includes(status)) {
      return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
    }
    // הצעה שכבר בוצעה (מייל יצא) לא חוזרת לתור: החזרה שלה מזמינה שליחה
    // שנייה של אותה הצעה לאותו מטפל.
    if (status === "pending") {
      const { data: current } = await supabaseAdmin
        .from("agent_actions")
        .select("status")
        .eq("id", id)
        .single();
      if (current?.status === "executed") {
        return NextResponse.json(
          { ok: false, error: "ההצעה כבר נשלחה בפועל - אי אפשר להחזיר אותה לתור" },
          { status: 409 }
        );
      }
    }
    const { error } = await supabaseAdmin
      .from("agent_actions")
      .update({
        status,
        status_changed_at: new Date().toISOString(),
        resolved_by: status === "pending" ? null : "admin",
        resolution_note: body?.note ? String(body.note) : null,
      })
      .eq("id", id);
    if (error) {
      // "החזר" על התראה שהסוכן כבר פתח מחדש נתקל באינדקס הייחודי - זו לא
      // תקלה אלא מצב צפוי, עם הסבר במקום כישלון שקט (ממצא ביקורת).
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "כבר קיימת הצעה זהה ממתינה בתור - אין צורך להחזיר את הישנה" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
