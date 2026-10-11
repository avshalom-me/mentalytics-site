"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RISK_LABELS, SOURCE_LABELS, TIER_LABELS, type ReviewAction, type ReviewFlag, type ReviewMetrics, type ReviewRisk, type ReviewTier } from "@/app/lib/retention-review";

// עמוד סקירת השימור השבועית. רובריקות, לא מלל (הבעלים, 11/10/26): לכל
// מטפל/ת שורה סגורה עם משפט אחד "מה לעשות", וכפתורים שפותחים את הפעולה
// עצמה (טיוטת המייל, ההקפאה, המשימה) ישירות מתחת לשורה. "פירוט" פותח רק
// שורת משפך אחת ואת הדגלים כצ'יפים; ההסבר של כל דגל בריחוף.
// הנתונים הם הצילום של הריצה האחרונה (retention_reviews); הכפתורים עובדים
// לפי המטפל/ת, גם בלי הצעה ממתינה בתור הסוכנים.

type Review = {
  id: string;
  week_start: string;
  created_at: string;
  summary: {
    checked?: number;
    byTier?: Record<ReviewTier, number>;
    byRisk?: Record<ReviewRisk, number>;
    actions?: number;
    holidayWeek?: string | null;
    benchmark?: { peers: number; cards: number; opens: number; people: number } | null;
    onlineShare?: number;
    excluded?: { suspended: number; unapproved: number; new?: number };
    model?: { cardReviews: number; drafts: number } | null;
  };
  acknowledged_at: string | null;
  acknowledged_by: string | null;
};

type Row = {
  id: string;
  therapist_id: string;
  name: string | null;
  tier: ReviewTier;
  risk: ReviewRisk;
  promotion_source: string | null;
  metrics: ReviewMetrics;
  flags: ReviewFlag[];
  actions: ReviewAction[];
  primary_action: string | null;
  risk_reason: string | null;
  todo: string | null;
};

type Pending = {
  id: string;
  action_type: string;
  entity_id: string | null;
  payload: { subject?: string | null; body?: string | null; days?: number | null; link?: string | null } | null;
};

type Done = {
  id: string;
  action_type: string;
  entity_id: string | null;
  status: string;
  status_changed_at: string | null;
  resolution_note: string | null;
};

type Outcome = {
  action_id: string;
  action_type: string;
  therapist_id: string;
  name: string;
  executed_at: string;
  days_since: number;
  before14: number;
  after14: number | null;
  after28: number | null;
  profile_edited: boolean;
  still_promoted: boolean;
  verdict: "recovered" | "edited" | "no_change" | "left" | "too_early";
};
type OutcomeSummary = { action_type: string; total: number; measured: number; recovered: number; edited: number; left: number };

type PostFn = (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; status: number; [k: string]: unknown }>;

const RISK_TONE: Record<ReviewRisk, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  medium: "bg-yellow-50 text-yellow-800 border-yellow-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  new: "bg-sky-50 text-sky-800 border-sky-200",
  paused: "bg-stone-100 text-stone-600 border-stone-200",
};
const OWNER_CHIP: Record<ReviewFlag["owner"], string> = {
  therapist: "border-violet-200 bg-violet-50 text-violet-800",
  us: "border-rose-200 bg-rose-50 text-rose-800",
  market: "border-stone-200 bg-stone-100 text-stone-600",
};
const OWNER_LABEL: Record<ReviewFlag["owner"], string> = { therapist: "אצל המטפל/ת", us: "אצלנו", market: "שוק" };
const ACTION_BUTTON: Record<string, string> = {
  fix: "🛠️ לתקן באדמין",
  freeze: "❄️ להקפיא שבוע",
  email: "✉️ טיוטת מייל",
  extend: "⏳ להאריך ניסיון",
  task: "📞 משימת שיחה",
  campaign: "📣 קמפיין",
};
const DONE_LABEL: Record<string, string> = { email: "✓ מייל נשלח", freeze: "✓ הוקפא/ה", task: "✓ משימה נפתחה", campaign: "✓ קמפיין טופל" };
const OUTCOME_LABEL: Record<Outcome["verdict"], string> = { recovered: "חזרו פניות", edited: "ערך/ה פרופיל", no_change: "בלי שינוי", left: "עזב/ה", too_early: "מוקדם מדי" };
const OUTCOME_TONE: Record<Outcome["verdict"], string> = { recovered: "text-emerald-700", edited: "text-sky-700", no_change: "text-stone-500", left: "text-red-700", too_early: "text-stone-400" };
const ACTION_TYPE_LABEL: Record<string, string> = { retention_email: "מייל שיפור", retention_freeze: "הקפאה שקטה", retention_task: "שיחת שימור" };

const ATTENTION = new Set<ReviewRisk>(["critical", "high", "medium"]);

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

function actionLabel(a: ReviewAction): string {
  if (a.type === "campaign" && a.region) return `📣 קמפיין ב${a.region}`;
  if (a.type === "freeze" && a.days && a.days !== 7) return `❄️ להקפיא ${a.days} ימים`;
  return ACTION_BUTTON[a.type] ?? a.title;
}

export default function RetentionPage() {
  const [review, setReview] = useState<Review | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showFine, setShowFine] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin-retention", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "שגיאה בטעינה");
      setReview(j.review);
      setRows(j.rows ?? []);
      setPending(j.pending ?? []);
      setDone(j.done ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post: PostFn = async (body) => {
    const r = await fetch("/api/admin-retention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ...j, ok: Boolean(j.ok), status: r.status };
  };

  async function runNow() {
    if (!confirm("להריץ את הסקירה עכשיו? הצילום של השבוע יוחלף, הטיוטות יתחדשו (כחצי דולר) והפעולות בתור יתרעננו.")) return;
    setRunning(true);
    setNotice("");
    try {
      const j = await post({ action: "run" });
      if (!j.ok) setError(String(j.error ?? "הריצה נכשלה"));
      else setNotice("הסקירה רצה. הנתונים למטה מעודכנים.");
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function ack() {
    if (!review) return;
    const j = await post({ action: "ack", review_id: review.id });
    if (j.ok) setReview({ ...review, acknowledged_at: new Date().toISOString(), acknowledged_by: "admin" });
  }

  const pendingFor = (therapistId: string, type: string): Pending | undefined =>
    pending.find((p) => p.entity_id === therapistId && p.action_type === `retention_${type}`);
  const doneFor = (therapistId: string, type: string): Done | undefined =>
    done.find((d) => d.entity_id === therapistId && d.action_type === `retention_${type}` && d.status === "executed");

  const byTier = useMemo(() => {
    const groups: Record<ReviewTier, Row[]> = { high: [], center: [], medium: [] };
    for (const r of rows) groups[r.tier]?.push(r);
    return groups;
  }, [rows]);

  const s = review?.summary ?? {};
  const byRisk = s.byRisk ?? ({} as Record<string, number>);
  const excluded = s.excluded;
  const excludedTotal = excluded ? excluded.suspended + excluded.unapproved + (excluded.new ?? 0) : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-stone-900">🤝 שימור מטפלים</h1>
            {review && (
              <p className="mt-1 text-sm text-stone-500">
                שבוע {fmtDate(review.week_start)} · רצה ב-{fmtDate(review.created_at)}
                {review.acknowledged_at ? ` · אושרה ב-${fmtDate(review.acknowledged_at)}` : ""}
                {s.holidayWeek ? ` · שבוע ${s.holidayWeek}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {review && !review.acknowledged_at && (
              <button type="button" onClick={ack} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-100">
                ראיתי
              </button>
            )}
            <button type="button" onClick={runNow} disabled={running} className="rounded-full bg-stone-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50">
              {running ? "מריץ…" : "הרץ סקירה עכשיו"}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
        {loading && <div className="py-10 text-center text-sm text-stone-400">טוען…</div>}

        {!loading && !review && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            עוד לא רצה אף סקירה. הריצה הראשונה - בכפתור למעלה; אחר כך היא רצה לבד כל יום ראשון בבוקר.
          </div>
        )}

        {review && (
          <>
            <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="קריטי" value={byRisk.critical ?? 0} tone="red" />
              <Stat label="סיכון גבוה" value={byRisk.high ?? 0} tone="amber" />
              <Stat label="סיכון בינוני" value={byRisk.medium ?? 0} tone="yellow" />
              <Stat label="תקינים" value={byRisk.ok ?? 0} tone="green" />
              <Stat label="מוקפאים" value={byRisk.paused ?? 0} />
              <Stat label="פעולות ממתינות" value={pending.filter((p) => p.action_type !== "alert").length} />
            </div>
            <p className="mb-6 text-[11px] text-stone-400">
              {s.benchmark ? `בנצ'מרק משלם פרטי (${s.benchmark.peers} עמיתים, 30 יום): ${s.benchmark.cards} כרטיסים · ${s.benchmark.opens} כניסות · ${s.benchmark.people} פונים.` : ""}
              {excluded && excludedTotal > 0 ? ` לא נבדקו: ${excluded.new ?? 0} חדשים (פחות מ-4 שבועות), ${excluded.suspended} מושהים, ${excluded.unapproved} לא מאושרים.` : ""}
              {" "}פניות = אנשים שונים.
            </p>

            {(["high", "center", "medium"] as ReviewTier[]).map((tier) => {
              const group = byTier[tier];
              if (group.length === 0) return null;
              const attention = group.filter((r) => ATTENTION.has(r.risk));
              const fine = group.filter((r) => !ATTENTION.has(r.risk));
              return (
                <section key={tier} className="mb-8">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-stone-700">
                    {TIER_LABELS[tier]} <span className="font-normal text-stone-400">({attention.length} דורשים מבט · {fine.length} תקינים)</span>
                  </h2>
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                    {attention.length === 0 && <div className="p-4 text-sm text-stone-400">כולם תקינים.</div>}
                    {attention.map((r) => (
                      <RowCard key={r.id} row={r} pendingFor={pendingFor} doneFor={doneFor} post={post} onChanged={load} />
                    ))}
                    {fine.length > 0 && (
                      <div className="border-t border-stone-100">
                        <button type="button" onClick={() => setShowFine((p) => ({ ...p, [tier]: !p[tier] }))} className="w-full px-4 py-2 text-start text-xs font-bold text-stone-500 hover:bg-stone-50">
                          {showFine[tier] ? "▾" : "◂"} תקינים ומוקפאים ({fine.length})
                        </button>
                        {showFine[tier] && fine.map((r) => <RowCard key={r.id} row={r} pendingFor={pendingFor} doneFor={doneFor} post={post} onChanged={load} />)}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            <Outcomes />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" | "yellow" | "green" }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : tone === "yellow" ? "text-yellow-700" : tone === "green" ? "text-emerald-700" : "text-stone-800";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

type RowCardProps = {
  row: Row;
  pendingFor: (therapistId: string, type: string) => Pending | undefined;
  doneFor: (therapistId: string, type: string) => Done | undefined;
  post: PostFn;
  onChanged: () => Promise<void>;
};

// השורה: חומרה, שם, משפט "מה לעשות", וכפתור לכל פעולה. לחיצה פותחת את
// הפעולה עצמה מתחת לשורה; "פירוט" פותח את המשפך והדגלים.
function RowCard({ row, pendingFor, doneFor, post, onChanged }: RowCardProps) {
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const m = row.metrics;
  const current = openAction ? row.actions.find((a) => a.type === openAction) : null;
  const buttonBase = "rounded-full border px-2.5 py-1 text-xs font-bold";
  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <span title={row.risk_reason ?? undefined} className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${RISK_TONE[row.risk]}`}>{RISK_LABELS[row.risk]}</span>
        <Link href={`/admin/therapists?therapist=${row.therapist_id}`} className="font-bold text-stone-900 hover:underline">{row.name}</Link>
        <span className="text-xs text-stone-400">
          {SOURCE_LABELS[row.promotion_source ?? ""] ?? row.promotion_source}
          {m.regions.length ? ` · ${m.regions.join(", ")}` : ""}
        </span>
        <span className="basis-full text-sm text-stone-800 sm:basis-auto sm:flex-1">{row.todo ?? row.risk_reason}</span>
        <span className="flex flex-wrap gap-1.5">
          {row.actions.map((a) => {
            const finished = doneFor(row.therapist_id, a.type);
            const label = finished ? DONE_LABEL[a.type] ?? actionLabel(a) : actionLabel(a);
            if (a.type === "fix") {
              return (
                <Link key={a.type} href={a.link ?? `/admin/therapists?therapist=${row.therapist_id}`} className={`${buttonBase} border-stone-800 bg-stone-800 text-white hover:bg-stone-700`}>
                  {label}
                </Link>
              );
            }
            const open = openAction === a.type;
            return (
              <button
                key={a.type}
                type="button"
                title={finished?.resolution_note ?? a.title}
                onClick={() => setOpenAction((v) => (v === a.type ? null : a.type))}
                className={`${buttonBase} ${open ? "border-stone-800 bg-stone-800 text-white" : finished ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
              >
                {label}
              </button>
            );
          })}
          <button type="button" onClick={() => setDetail((v) => !v)} className={`${buttonBase} ${detail ? "border-stone-500 bg-stone-100 text-stone-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
            {detail ? "▾ פירוט" : "◂ פירוט"}
          </button>
        </span>
      </div>

      {current && (
        <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-3">
          <ActionCard
            key={current.type}
            row={row}
            action={current}
            pending={pendingFor(row.therapist_id, current.type)}
            finished={doneFor(row.therapist_id, current.type)}
            post={post}
            onChanged={onChanged}
            onClose={() => setOpenAction(null)}
          />
        </div>
      )}

      {detail && <Detail row={row} />}
    </div>
  );
}

// הפירוט: שורת משפך אחת והדגלים כצ'יפים. ההסבר המלא של כל דגל בריחוף.
function Detail({ row }: { row: Row }) {
  const m = row.metrics;
  const prev = `30 הימים הקודמים: ${m.cards_prev} כרטיסים, ${m.opens_prev} כניסות, ${m.people_prev} פונים`;
  const last = m.daysSinceContact != null ? `פנייה אחרונה לפני ${m.daysSinceContact} ימים` : "אף פנייה מעולם";
  const facts: string[] = [last, `ותק ${m.tenureDays} ימים`];
  if (m.regionCardShare != null && m.regionPromoted > 1) facts.push(`${Math.round(m.regionCardShare * 100)}% מהכרטיסים באזור (${m.regionPromoted} מקודמים)`);
  if (m.paid_cards_cur > 0 && m.cards_cur > 0) facts.push(`${Math.round((m.paid_cards_cur / m.cards_cur) * 100)}% מהכרטיסים ממבקרים ממומנים`);
  if (m.avg_score_cur != null) facts.push(`ציון התאמה ${Math.round(m.avg_score_cur)}`);
  if (m.pausedUntil) facts.push(`מוקפא/ת עד ${fmtDate(m.pausedUntil)}`);
  return (
    <div className="space-y-2 border-t border-stone-100 bg-stone-50/60 px-4 py-3 text-xs text-stone-600">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1" title={prev}>
        <span className="font-bold text-stone-500">30 יום:</span>
        <span className="font-semibold text-stone-800">{m.cards_cur} כרטיסים{m.cardsBenchmark != null ? <span className="font-normal text-stone-400"> (עמיתים {m.cardsBenchmark}{m.benchmarkScope === "region" ? " באזור" : ""})</span> : null}</span>
        <span className="text-stone-300">←</span>
        <span className="font-semibold text-stone-800">{m.opens_cur} כניסות</span>
        <span className="text-stone-300">←</span>
        <span className="font-semibold text-stone-800">{m.people_cur} פונים<span className="font-normal text-stone-400"> ({m.clicks_cur} לחיצות)</span></span>
        <span className="text-stone-400">· {facts.join(" · ")}</span>
      </div>
      {row.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {row.flags.map((f) => (
            <span key={f.key} title={`${OWNER_LABEL[f.owner]}: ${f.detail}`} className={`cursor-help rounded-full border px-2 py-0.5 ${OWNER_CHIP[f.owner]}`}>
              {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type ActionCardProps = {
  row: Row;
  action: ReviewAction;
  pending: Pending | undefined;
  finished: Done | undefined;
  post: PostFn;
  onChanged: () => Promise<void>;
  onClose: () => void;
};

// כרטיס הפעולה: הטיוטה או הכפתור, מוכנים ללחיצה. עובד לפי המטפל/ת; ההצעה
// הממתינה בתור, אם יש, נסגרת בשרת כחלק מהביצוע.
function ActionCard({ row, action, pending, finished, post, onChanged, onClose }: ActionCardProps) {
  const [subject, setSubject] = useState(pending?.payload?.subject ?? action.subject ?? "");
  const [body, setBody] = useState(pending?.payload?.body ?? action.body ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(payload: Record<string, unknown>, okText: string) {
    setBusy(true);
    setMsg("");
    const base = { ...payload, therapist_id: row.therapist_id, ...(pending ? { id: pending.id } : {}) };
    try {
      let j = await post(base);
      if (!j.ok && j.status === 409 && j.cooled && confirm(`${j.error}\n\nלשלוח בכל זאת?`)) {
        j = await post({ ...base, force: true });
      }
      if (!j.ok) setMsg(String(j.error ?? "נכשל"));
      else {
        setMsg(okText);
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(note: string) {
    if (pending) await post({ action: "dismiss", therapist_id: row.therapist_id, id: pending.id, type: action.type, note });
    await onChanged();
    onClose();
  }

  const primary = "rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50";
  const secondary = "rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 disabled:opacity-50";
  const quiet = "rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-500";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-stone-800">{actionLabel(action)}</span>
        {finished && <span className="text-[11px] text-emerald-700">✓ {finished.resolution_note ?? "בוצע"} · {fmtDate(finished.status_changed_at)}</span>}
      </div>
      <p className="mb-2 text-xs text-stone-500">{action.detail}</p>

      {action.type === "email" && (
        <div className="space-y-2">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm leading-relaxed" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run({ action: "email_send", subject, body }, "המייל נשלח.")} className={primary}>
              {finished ? `לשלוח שוב ל${row.name}` : `שלח ל${row.name}`}
            </button>
            <button type="button" disabled={busy} onClick={() => dismiss("לא רלוונטי")} className={quiet}>לא לשלוח</button>
          </div>
        </div>
      )}
      {action.type === "freeze" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run({ action: "freeze", days: 7 }, "הוקפא/ה לשבוע.")} className={primary}>❄️ הקפא שבוע</button>
          <button type="button" disabled={busy} onClick={() => run({ action: "freeze", days: 14 }, "הוקפא/ה לשבועיים.")} className={secondary}>שבועיים</button>
          <button type="button" disabled={busy} onClick={() => dismiss("לא להקפיא")} className={quiet}>לא</button>
        </div>
      )}
      {action.type === "task" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run({ action: "task" }, "נפתחה משימה.")} className={primary}>📞 פתח משימת שיחה</button>
          <button type="button" disabled={busy} onClick={() => dismiss("בלי שיחה")} className={quiet}>לא</button>
        </div>
      )}
      {action.type === "extend" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => { if (confirm(`להאריך את הניסיון של ${row.name} ב-30 ימים? לא נשלח שום מייל.`)) run({ action: "extend_trial", days: 30 }, "הניסיון הוארך ב-30 ימים."); }} className={primary}>⏳ +30 ימים</button>
          <button type="button" disabled={busy} onClick={() => { if (confirm(`להאריך את הניסיון של ${row.name} ב-14 ימים? לא נשלח שום מייל.`)) run({ action: "extend_trial", days: 14 }, "הניסיון הוארך ב-14 ימים."); }} className={secondary}>+14</button>
        </div>
      )}
      {action.type === "campaign" && <CampaignCard row={row} action={action} post={post} onChanged={onChanged} />}
      {msg && <p className="mt-2 text-xs text-stone-600">{msg}</p>}
    </div>
  );
}

// הלחיצה בגוגל עצמו: העלאת תקציב, הפעלה מחדש, או הקמה (מושהה) ואז הפעלה.
// כל אחת עם אישור בדפדפן; חריגה מהתקרה החודשית חוזרת כ-409 ודורשת אישור שני.
function CampaignCard({ row, action, post, onChanged }: { row: Row; action: ReviewAction; post: PostFn; onChanged: () => Promise<void> }) {
  const c = action.campaign;
  const [amount, setAmount] = useState<number>(c?.kind === "budget" ? (c.to ?? 10) : 10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [created, setCreated] = useState<{ campaignId: string; name: string; daily: number } | null>(null);

  async function call(payload: Record<string, unknown>, question: string, okText: (j: Record<string, unknown>) => string): Promise<Record<string, unknown> | null> {
    if (!confirm(question)) return null;
    setBusy(true);
    setMsg("");
    try {
      const base = { ...payload, therapist_id: row.therapist_id };
      let j = await post(base);
      if (!j.ok && j.status === 409 && j.overCeiling && confirm(`${j.error}\n\nלחרוג מהתקרה בכל זאת?`)) j = await post({ ...base, override: true });
      if (!j.ok) {
        setMsg(String(j.error ?? "נכשל"));
        return null;
      }
      setMsg(okText(j));
      await onChanged();
      return j;
    } finally {
      setBusy(false);
    }
  }

  const primary = "rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50";
  const field = "w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm";

  if (!c) {
    return <Link href={action.link ?? "/admin/ads"} className="inline-block rounded-full border border-stone-300 px-4 py-1.5 text-xs font-bold text-stone-700">📣 לעמוד הפרסום{action.region ? ` (${action.region})` : ""}</Link>;
  }
  return (
    <div className="space-y-2">
      {c.kind === "budget" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">{c.name} היום: ₪{c.from ?? "?"} ליום</span>
          <input type="number" min={5} max={200} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={field} />
          <button
            type="button"
            disabled={busy || !Number.isFinite(amount)}
            onClick={() => call({ action: "campaign_budget", campaign_id: c.campaignId, to: amount }, `לעדכן את התקציב היומי של ${c.name} מ-₪${c.from ?? "?"} ל-₪${amount}? השינוי בגוגל מיידי.`, (j) => `התקציב של ${String(j.name)} עודכן ל-₪${String(j.to)} ליום.`)}
            className={primary}
          >
            ⬆️ לעדכן ל-₪{amount} ליום
          </button>
        </div>
      )}
      {c.kind === "enable" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => call({ action: "campaign_status", campaign_id: c.campaignId, status: "ENABLED" }, `להפעיל מחדש את ${c.name}${c.from != null ? ` (₪${c.from} ליום)` : ""}? הקמפיין יתחיל להוציא כסף מיד.`, (j) => `${String(j.name)} הופעל.`)}
          className={primary}
        >
          ▶️ להפעיל מחדש את {c.name}
        </button>
      )}
      {c.kind === "create" && !created && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">תקציב יומי לקמפיין החדש:</span>
          <input type="number" min={5} max={200} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={field} />
          <button
            type="button"
            disabled={busy || !Number.isFinite(amount)}
            onClick={async () => {
              const j = await call({ action: "campaign_create", region: c.region, daily: amount }, `ליצור בגוגל קמפיין חיפוש ל${c.region} (₪${amount} ליום, מושהה)? הוא לא יוציא כסף עד שתלחץ/י "להפעיל".`, (r) => `נוצר ${String(r.name)} (מושהה): ${String(r.keywords)} מילים, ₪${String(r.daily)} ליום.`);
              if (j) setCreated({ campaignId: String(j.campaignId), name: String(j.name), daily: Number(j.daily) });
            }}
            className={primary}
          >
            📣 ליצור קמפיין מושהה ב{c.region}
          </button>
        </div>
      )}
      {c.kind === "create" && created && (
        <button
          type="button"
          disabled={busy}
          onClick={() => call({ action: "campaign_status", campaign_id: created.campaignId, status: "ENABLED" }, `להפעיל את ${created.name} (₪${created.daily} ליום)? מכאן הוא מוציא כסף.`, (j) => `${String(j.name)} הופעל.`)}
          className={primary}
        >
          ▶️ להפעיל את {created.name}
        </button>
      )}
      {msg && <p className="text-xs text-stone-600">{msg}</p>}
    </div>
  );
}

// "מה קרה למה שעשינו": נטען רק כשפותחים, כי זו שאילתה על 90 יום של לחיצות.
function Outcomes() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Outcome[] | null>(null);
  const [summary, setSummary] = useState<OutcomeSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || rows) return;
    fetch("/api/admin-retention?outcomes=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "שגיאה");
        setRows(j.rows ?? []);
        setSummary(j.summary ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"));
  }, [open, rows]);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-start text-sm font-black text-stone-600 hover:bg-stone-50">
        <span>{open ? "▾" : "◂"} מה קרה למה שעשינו (90 יום)</span>
        <span className="text-xs font-normal text-stone-400">פניות = אנשים, 14 יום לפני הפעולה מול 14 ו-28 אחריה</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 px-4 py-3">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!rows && !error && <p className="text-sm text-stone-400">טוען…</p>}
          {rows && rows.length === 0 && <p className="text-sm text-stone-400">עוד לא בוצעה אף פעולה מהסקירה.</p>}
          {rows && rows.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {summary.map((sm) => (
                  <span key={sm.action_type} className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                    <b>{ACTION_TYPE_LABEL[sm.action_type] ?? sm.action_type}</b>: {sm.total} בוצעו · {sm.measured} נמדדו · {sm.recovered} חזרו פניות · {sm.edited} ערכו פרופיל · {sm.left} עזבו
                  </span>
                ))}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-start text-stone-400">
                    <th className="py-1 text-start font-semibold">מטפל/ת</th>
                    <th className="py-1 text-start font-semibold">פעולה</th>
                    <th className="py-1 text-start font-semibold">מתי</th>
                    <th className="py-1 text-start font-semibold">לפני (14 יום)</th>
                    <th className="py-1 text-start font-semibold">אחרי 14</th>
                    <th className="py-1 text-start font-semibold">אחרי 28</th>
                    <th className="py-1 text-start font-semibold">תוצאה</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.action_id} className="border-t border-stone-100">
                      <td className="py-1.5"><Link href={`/admin/therapists?therapist=${o.therapist_id}`} className="font-semibold text-stone-800 hover:underline">{o.name}</Link></td>
                      <td className="py-1.5 text-stone-600">{ACTION_TYPE_LABEL[o.action_type] ?? o.action_type}</td>
                      <td className="py-1.5 text-stone-500">{fmtDate(o.executed_at)} ({o.days_since} ימים)</td>
                      <td className="py-1.5">{o.before14}</td>
                      <td className="py-1.5">{o.after14 ?? "-"}</td>
                      <td className="py-1.5">{o.after28 ?? "-"}</td>
                      <td className={`py-1.5 font-bold ${OUTCOME_TONE[o.verdict]}`}>{OUTCOME_LABEL[o.verdict]}{o.profile_edited && o.verdict !== "edited" ? " · ערך/ה פרופיל" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </section>
  );
}
