import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeEnrichedStats } from "@/app/lib/therapist-stats";

export const dynamic = "force-dynamic";

async function getTherapistInfo(
  req: NextRequest,
): Promise<{ id: string; status: string; created_at: string | null; promoted_since: string | null } | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  // Validate token via Supabase auth using the anon key (for user context)
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return null;

  // Strict user_id match only. No claim-by-email here: the dashboard always
  // loads /api/therapist-profile first, which performs the (guarded) claim and
  // links user_id — so by the time stats are requested, the link exists. An
  // email match without that link proves nothing (emails are not verified).
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, status, created_at, promoted_since")
    .eq("user_id", user.id)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        status: data.status,
        created_at: data.created_at as string | null,
        promoted_since: (data.promoted_since as string | null) ?? null,
      }
    : null;
}

type ClickRow = { click_type: string; source: string; clicked_at: string };

function sumByType(rows: ClickRow[]) {
  const result = { whatsapp: 0, phone: 0, email: 0, site_message: 0, total: 0 };
  for (const row of rows) {
    if (row.click_type === "whatsapp") result.whatsapp++;
    else if (row.click_type === "phone") result.phone++;
    else if (row.click_type === "email") result.email++;
    else if (row.click_type === "site_message") result.site_message++;
    result.total++;
  }
  return result;
}

/** מגמות חודשיות — 6 חודשים אחרונים */
function buildMonthlyTrends(rows: ClickRow[]) {
  const now = new Date();
  const months: { label: string; total: number; match: number; directory: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const monthRows = rows.filter(r => {
      const t = new Date(r.clicked_at);
      return t >= start && t < end;
    });
    months.push({
      label,
      total: monthRows.length,
      match: monthRows.filter(r => r.source === "match").length,
      // Everything that isn't a match-flow contact: directory cards, profile
      // page buttons, and legacy rows with no source. An exact === "directory"
      // here would silently drop profile-page contacts from the therapist's own
      // dashboard the moment that source started being recorded.
      directory: monthRows.filter(r => r.source !== "match").length,
    });
  }
  return months;
}

export async function GET(req: NextRequest) {
  const info = await getTherapistInfo(req);
  if (!info) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isPaying = info.status === "paying";

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // For trends we need 6 months of data
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const since = isPaying ? sixMonthsAgo : monthAgo;

  const { data, error } = await supabaseAdmin
    .from("therapist_contact_clicks")
    .select("click_type, source, clicked_at")
    .eq("therapist_id", info.id)
    .gte("clicked_at", since.toISOString())
    .order("clicked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ClickRow[];
  const monthRows = rows.filter(r => new Date(r.clicked_at) >= monthAgo);
  const weekRows = monthRows.filter(r => new Date(r.clicked_at) >= weekAgo);

  // Basic stats (for all therapists)
  const result: Record<string, unknown> = {
    ok: true,
    week: sumByType(weekRows),
    month: sumByType(monthRows),
  };

  // Enhanced stats (paying only)
  if (isPaying) {
    result.trends = buildMonthlyTrends(rows);

    // Paying dashboards show CUMULATIVE numbers since joining — no period
    // splits (product decision 19/7): all-time exposure, all-time profile
    // entries, and all-time contacts split by acquisition source.
    try {
      // כל ספירה רצה פעמיים: מצטבר, ושוב חתוכה מרגע הקידום. המספר
      // המצטבר כולל את תקופת החינם - מטפל שצבר מאות צפיות במאגר לפני
      // שקודם רואה אותן כאילו הקידום ייצר אותן, ומי שאצלו הקידום באמת
      // עבד לא רואה את זה. שתי השורות יחד עונות על "מה הקידום עשה לי",
      // וזו השאלה שמכריעה אם להמשיך אחרי חודשי המתנה.
      const promotedSince = info.promoted_since;
      const countViews = (sources: string[], since?: string | null) => {
        let q = supabaseAdmin
          .from("therapist_profile_views")
          .select("*", { count: "exact", head: true })
          .eq("therapist_id", info.id)
          .in("source", sources);
        if (since) q = q.gte("viewed_at", since);
        return q;
      };
      const countClicks = (matchOnly: boolean, since?: string | null) => {
        let q = supabaseAdmin
          .from("therapist_contact_clicks")
          .select("*", { count: "exact", head: true })
          .eq("therapist_id", info.id);
        if (matchOnly) q = q.eq("source", "match");
        if (since) q = q.gte("clicked_at", since);
        return q;
      };
      // הודעות שנשלחו דרך טופס האתר — הערוץ היחיד שאנחנו יודעים בוודאות
      // שהגיע ליעד (נשלח מייל). שאר הסוגים הם לחיצות: המטופל לחץ על
      // וואטסאפ/חיוג/מייל, ואין לנו דרך לדעת אם השלים. הדשבורד מציג את
      // ההפרדה כדי שמטפל לא יצפה להודעה שמעולם לא נשלחה.
      const countMessages = (since?: string | null) => {
        let q = supabaseAdmin
          .from("therapist_contact_clicks")
          .select("*", { count: "exact", head: true })
          .eq("therapist_id", info.id)
          .eq("click_type", "site_message");
        if (since) q = q.gte("clicked_at", since);
        return q;
      };
      // הופעות במאגר המטפלים נרשמות כאירוע analytics ולא כ-profile_view -
      // הכרטיס נראה ברשימה אך לא נפתח. בלעדיהן הדשבורד הראה רק את חשיפת
      // ההתאמות, שהיא מיעוט מהחשיפה בפועל.
      const countDirectoryImpressions = (since?: string | null) => {
        let q = supabaseAdmin
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("therapist_id", info.id)
          .eq("event_type", "profile_impression");
        if (since) q = q.gte("created_at", since);
        return q;
      };

      const [
        entries, impressions, dirImpressions, contactsTotal, contactsMatch, contactsMessages,
        pEntries, pImpressions, pDirImpressions, pContacts, pMessages,
      ] = await Promise.all([
        countViews(["match", "directory"]),
        countViews(["match_card"]),
        countDirectoryImpressions(),
        countClicks(false),
        countClicks(true),
        countMessages(),
        countViews(["match", "directory"], promotedSince),
        countViews(["match_card"], promotedSince),
        countDirectoryImpressions(promotedSince),
        countClicks(false, promotedSince),
        countMessages(promotedSince),
      ]);
      const total = contactsTotal.count ?? 0;
      const match = contactsMatch.count ?? 0;
      const messages = contactsMessages.count ?? 0;
      result.profile_views = { all_time: entries.count ?? 0 };
      result.match_impressions = { all_time: impressions.count ?? 0 };
      result.directory_impressions = { all_time: dirImpressions.count ?? 0 };
      result.all_time_contacts = { total, match, directory: total - match, messages, clicks: total - messages };
      // null כשאין תאריך קידום - הדשבורד פשוט לא מציג את השורה השנייה.
      result.since_promotion = promotedSince
        ? {
            since: promotedSince,
            profile_views: pEntries.count ?? 0,
            match_impressions: pImpressions.count ?? 0,
            directory_impressions: pDirImpressions.count ?? 0,
            contacts: pContacts.count ?? 0,
            messages: pMessages.count ?? 0,
          }
        : null;
    } catch {
      result.profile_views = { all_time: 0 };
      result.match_impressions = { all_time: 0 };
      result.directory_impressions = { all_time: 0 };
      result.all_time_contacts = { total: 0, match: 0, directory: 0, messages: 0, clicks: 0 };
      result.since_promotion = null;
    }

    // Enriched breakdown (by region / issue / age / gender + conversion)
    try {
      // מצטבר מאז ההצטרפות, לא 30 יום. חלון קצר גם סתר את החלק העליון של
      // הדשבורד (שמצטבר מאז ההצטרפות) - אותה תווית הראתה שני מספרים שונים -
      // וגם חסם את הניתוח המעמיק מאחורי סף של 20 צפיות שמעט מטפלים עוברים
      // בחודש בודד, בזמן שמצטבר יש להם מספיק נתונים.
      result.enriched = await computeEnrichedStats(
        info.id,
        info.created_at ? new Date(info.created_at) : new Date(0),
      );
    } catch {
      // Non-critical — dashboard shows a placeholder if this is absent
    }

    // (The vs-average comparison block was removed per product decision 19/7 —
    // it read as judgmental and the average is skewed by a few heavy profiles.)
  }

  return NextResponse.json(result);
}
