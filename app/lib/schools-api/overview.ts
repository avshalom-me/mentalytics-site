import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  CLOSED_DEAL_STAGES,
  DEAL_STAGES,
  SCHOOL_STATUSES,
  addMonthsIso,
  calendarQuarter,
  countsForGate,
  gateReceiptValue,
  ladderStatus,
  licenseUsable,
  schoolYearOf,
  type GateEvent,
  type LicenseLike,
} from "@/app/lib/schools-crm";
import { BRANCH_TASK_TYPES } from "@/app/lib/schools-workspace";
import { SchoolsCrmError, getBranchSettings, proposeTransferMatches, type Viewer } from "@/app/lib/schools-crm.server";

// "מבט על" של ענף בתי הספר: המסך הראשון של ה-CRM המשותף, לבעלים ולשותפה.
// התוכן נגזר מסעיף 16.1 בהסכם (מה ששותפה רואה בלוח המחוונים: תקבולים לפי לקוח,
// חשבוניות פתוחות, השיעור החל, ההתקדמות מול שערי השלב, הלקוחות הפעילים), ועוד
// מה שהעבודה היומית צריכה: הצינור, השימוש בשאלון ומה דורש טיפול.
//
// בית ספר הדגמה לא נספר בשום מספר כאן. כל הסכומים נטו (בלי מע"מ), כמו בהסכם,
// חוץ מ"פתוח לגבייה" שהוא מה שבית הספר משלם בפועל (כולל מע"מ).

type Pay = { id: string; seq: number; amount_gross: number; amount_net: number; due_date: string | null; status: string; received_at: string | null };
type Lic = LicenseLike & { id: string; school_id: string; school_year: string; schools: { name: string; is_demo: boolean } | null; school_payments: Pay[] };

const ilDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));
const round = (n: number) => Math.round(n * 100) / 100;

export async function overviewGet(v: Viewer) {
  try {
    const today = ilDay(new Date().toISOString());
    const settings = await getBranchSettings();
    const since90 = addMonthsIso(today, -3);
    const [lic, schools, deals, usage, tasks, acts, demo] = await Promise.all([
      supabaseAdmin
        .from("school_licenses")
        .select("id, school_id, kind, status, school_year, start_date, end_date, price_net, months, paid_at, refunded_at, code_disabled, schools!inner(name, is_demo), school_payments(id, seq, amount_gross, amount_net, due_date, status, received_at)")
        .eq("schools.is_demo", false),
      supabaseAdmin.from("schools").select("id, status, is_demo").eq("is_demo", false),
      supabaseAdmin.from("school_deals").select("id, school_id, stage, value_gross, next_step_due, source, created_at, closed_at, schools(is_demo)"),
      supabaseAdmin.from("school_usage_daily").select("school_id, day, count, schools!inner(is_demo)").eq("schools.is_demo", false).gte("day", since90),
      supabaseAdmin.from("crm_tasks").select("id, due_date, assignee, status").in("entity_type", [...BRANCH_TASK_TYPES]).in("status", ["open", "in_progress"]),
      // פעולות שאנשים רשמו (שיחה, פגישה, וואטסאפ...), בלי רישומי המערכת.
      supabaseAdmin.from("school_activities").select("entity_id, happened_at").neq("kind", "system").gte("happened_at", `${since90}T00:00:00+03:00`).limit(5000),
      supabaseAdmin.from("schools").select("id, school_deals(id), school_licenses(id)").eq("is_demo", true),
    ]);
    for (const r of [lic, schools, deals, usage, tasks, acts, demo]) if (r.error) throw new SchoolsCrmError(r.error.message, 500);

    const licenses = (lic.data ?? []) as unknown as Lic[];
    const sy = schoolYearOf(today);
    const quarter = calendarQuarter(today);

    // ── תקבולים, גבייה, לקוחות ─────────────────────────────────────────────────
    let receivedTotal = 0;
    let receivedYear = 0;
    let receivedQuarter = 0;
    let openGross = 0;
    let overdueGross = 0;
    let overdueCount = 0;
    let dueSoonGross = 0;
    const in30 = addMonthsIso(today, 1);
    const byMonth = new Map<string, number>();
    const bySchool = new Map<string, { name: string; net: number }>();
    const events: GateEvent[] = [];
    const payingSince = new Map<string, string>();
    let activeLicenses = 0;
    let renewSoon = 0;
    const renewLimit = addMonthsIso(today, 2);
    const activeSchoolIds = new Set<string>();

    for (const l of licenses) {
      const name = l.schools?.name ?? "";
      if (licenseUsable(l, today)) {
        activeLicenses++;
        activeSchoolIds.add(l.school_id);
        if (l.end_date <= renewLimit) renewSoon++;
      }
      if (countsForGate(l, settings) && l.paid_at) {
        const d = ilDay(l.paid_at);
        const prev = payingSince.get(l.school_id);
        if (!prev || d < prev) payingSince.set(l.school_id, d);
      }
      for (const p of l.school_payments ?? []) {
        const net = Number(p.amount_net);
        if (p.status === "received" && p.received_at) {
          const d = ilDay(p.received_at);
          receivedTotal += net;
          if (d >= sy.start && d <= sy.end) receivedYear += net;
          if (d >= quarter.start && d <= quarter.end) receivedQuarter += net;
          byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + net);
          const cur = bySchool.get(l.school_id) ?? { name, net: 0 };
          cur.net += net;
          bySchool.set(l.school_id, cur);
          if (l.kind === "annual" || l.kind === "partial") events.push({ date: d, receipts: gateReceiptValue(net, l) });
        }
        if (p.status === "expected" && (l.status === "pending_payment" || l.status === "active")) {
          const g = Number(p.amount_gross);
          openGross += g;
          if (p.due_date && p.due_date < today) {
            overdueGross += g;
            overdueCount++;
          } else if (p.due_date && p.due_date <= in30) dueSoonGross += g;
        }
      }
    }
    for (const d of payingSince.values()) events.push({ date: d, schools: 1 });
    const ladder = ladderStatus(settings, events, today);

    // חודשים מיום ההתחלה (או 6 אחרונים), גם חודש בלי תקבולים מופיע כאפס.
    const firstMonth = (settings.start_date ?? addMonthsIso(today, -5)).slice(0, 7);
    const months: { month: string; net: number }[] = [];
    for (let m = `${firstMonth}-01`; m.slice(0, 7) <= today.slice(0, 7); m = addMonthsIso(m, 1)) {
      months.push({ month: m.slice(0, 7), net: round(byMonth.get(m.slice(0, 7)) ?? 0) });
      if (months.length > 24) break;
    }

    // ── צינור ─────────────────────────────────────────────────────────────────
    type DealRow = { id: string; stage: string; value_gross: number | null; next_step_due: string | null; source: string | null; created_at: string; closed_at: string | null; schools: { is_demo: boolean } | null };
    const dealRows = ((deals.data ?? []) as unknown as DealRow[]).filter((d) => !d.schools?.is_demo);
    const closed = CLOSED_DEAL_STAGES as readonly string[];
    const pipeline = DEAL_STAGES.filter((s) => !closed.includes(s.value)).map((s) => {
      const rows = dealRows.filter((d) => d.stage === s.value);
      return { stage: s.value, label: s.label, count: rows.length, value: round(rows.reduce((a, d) => a + Number(d.value_gross ?? 0), 0)) };
    });
    const openDeals = dealRows.filter((d) => !closed.includes(d.stage) && d.stage !== "frozen");
    const wonYear = dealRows.filter((d) => d.stage === "active" && d.closed_at && ilDay(d.closed_at) >= sy.start).length;
    const lostYear = dealRows.filter((d) => d.stage === "lost" && d.closed_at && ilDay(d.closed_at) >= sy.start).length;
    const staleNext = openDeals.filter((d) => d.next_step_due && d.next_step_due < today).length;
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const newInbound = dealRows.filter((d) => d.source === "inbound" && d.stage === "contacted" && d.created_at >= twoWeeksAgo).length;

    // ── שימוש בשאלון: 12 שבועות, ובתי ספר פעילים שלא השתמשו 30 יום ─────────────
    const usageRows = (usage.data ?? []) as { school_id: string; day: string; count: number }[];
    const weekStart = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // יום ראשון
      return d.toISOString().slice(0, 10);
    };
    const weeks: { week: string; count: number }[] = [];
    const thisWeek = weekStart(today);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(`${thisWeek}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weeks.push({ week: d.toISOString().slice(0, 10), count: 0 });
    }
    const usedRecently = new Set<string>();
    const since30 = addMonthsIso(today, -1);
    for (const u of usageRows) {
      const w = weeks.find((x) => x.week === weekStart(u.day));
      if (w) w.count += Number(u.count);
      if (u.day >= since30) usedRecently.add(u.school_id);
    }
    const idleActive = [...activeSchoolIds].filter((id) => !usedRecently.has(id)).length;
    const usage30 = usageRows.filter((u) => u.day >= since30).reduce((a, u) => a + Number(u.count), 0);

    // ── משימות ────────────────────────────────────────────────────────────────
    const taskRows = (tasks.data ?? []) as { due_date: string | null; assignee: string | null }[];
    const overdueTasks = taskRows.filter((t) => t.due_date && t.due_date < today);
    const myOverdue = overdueTasks.filter((t) => t.assignee === v.name).length;

    // דף הבנק של החברה: רק לבעלים.
    let bankWaiting: number | null = null;
    if (v.role === "owner") {
      try {
        bankWaiting = (await proposeTransferMatches()).proposals.length;
      } catch {
        bankWaiting = null;
      }
    }

    // פעילות שנרשמה לפי שבוע, בלי מה שנרשם על בית ספר ההדגמה.
    type DemoRow = { id: string; school_deals: { id: string }[] | null; school_licenses: { id: string }[] | null };
    const demoIds = new Set<string>();
    for (const r of (demo.data ?? []) as DemoRow[]) {
      demoIds.add(r.id);
      for (const x of r.school_deals ?? []) demoIds.add(x.id);
      for (const x of r.school_licenses ?? []) demoIds.add(x.id);
    }
    const activityWeeks = weeks.map((w) => ({ week: w.week, count: 0 }));
    for (const a of (acts.data ?? []) as { entity_id: string; happened_at: string }[]) {
      if (demoIds.has(a.entity_id)) continue;
      const w = activityWeeks.find((x) => x.week === weekStart(ilDay(a.happened_at)));
      if (w) w.count++;
    }

    const statusCounts: Record<string, number> = {};
    for (const s of (schools.data ?? []) as { status: string }[]) statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;

    const topCustomers = [...bySchool.entries()]
      .map(([id, x]) => ({ school_id: id, name: x.name, net: round(x.net) }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      today,
      school_year: sy.label,
      quarter: { ...quarter, received_net: round(receivedQuarter) },
      ladder,
      money: {
        received_total_net: round(receivedTotal),
        received_year_net: round(receivedYear),
        open_gross: round(openGross),
        overdue_gross: round(overdueGross),
        overdue_count: overdueCount,
        due_30_gross: round(dueSoonGross),
      },
      months,
      customers: {
        paying: payingSince.size,
        active_licenses: activeLicenses,
        schools_by_status: statusCounts,
        status_rows: SCHOOL_STATUSES.map((s) => ({ status: s.value, label: s.label, count: statusCounts[s.value] ?? 0 })),
        top: topCustomers,
      },
      activity: { weeks: activityWeeks },
      pipeline: { stages: pipeline, open_count: openDeals.length, open_value: round(openDeals.reduce((a, d) => a + Number(d.value_gross ?? 0), 0)), won_year: wonYear, lost_year: lostYear },
      usage: { weeks, last30: usage30, idle_active: idleActive },
      attention: {
        overdue_payments: overdueCount,
        overdue_tasks: overdueTasks.length,
        my_overdue_tasks: myOverdue,
        stale_next_steps: staleNext,
        new_inbound: newInbound,
        renew_soon: renewSoon,
        idle_active: idleActive,
        bank_waiting: bankWaiting,
      },
    });
  } catch (e) {
    if (e instanceof SchoolsCrmError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("schools-api/overview:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה בשרת" }, { status: 500 });
  }
}
