"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RISK_LABELS, SOURCE_LABELS, TIER_LABELS, type ReviewAction, type ReviewFlag, type ReviewMetrics, type ReviewRisk, type ReviewTier } from "@/app/lib/retention-review";

// עמוד סקירת השימור השבועית: המפה (מי בסיכון ולמה), והכפתורים. הנתונים הם
// הצילום של הריצה האחרונה (retention_reviews), והפעולות הן שורות agent_actions
// ממתינות של הסוכן; שליחה, הקפאה ומשימה עוברות דרך /api/admin-retention.

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
    demandTotal?: number;
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
};

type Pending = {
  id: string;
  action_type: string;
  title: string;
  body: string | null;
  severity: string;
  entity_id: string | null;
  payload: { subject?: string | null; body?: string | null; days?: number | null; link?: string | null } | null;
};

const RISK_TONE: Record<ReviewRisk, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  medium: "bg-yellow-50 text-yellow-800 border-yellow-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  new: "bg-sky-50 text-sky-800 border-sky-200",
  paused: "bg-stone-100 text-stone-600 border-stone-200",
};
const OWNER_LABEL: Record<ReviewFlag["owner"], string> = { therapist: "אצל המטפל/ת", us: "אצלנו", market: "שוק" };
const OWNER_TONE: Record<ReviewFlag["owner"], string> = { therapist: "text-violet-700", us: "text-rose-700", market: "text-stone-500" };
const ACTION_ICON: Record<string, string> = { fix: "🛠️", freeze: "❄️", email: "✉️", task: "📞", campaign: "📣" };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

export default function RetentionPage() {
  const [review, setReview] = useState<Review | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showOk, setShowOk] = useState<Record<string, boolean>>({});

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; status: number; [k: string]: unknown }> {
    const r = await fetch("/api/admin-retention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ...j, ok: Boolean(j.ok), status: r.status };
  }

  async function runNow() {
    if (!confirm("להריץ את הסקירה עכשיו? הצילום של השבוע יוחלף והפעולות בתור יתרעננו.")) return;
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

  const byTier = useMemo(() => {
    const groups: Record<ReviewTier, Row[]> = { high: [], center: [], medium: [] };
    for (const r of rows) groups[r.tier]?.push(r);
    return groups;
  }, [rows]);

  const s = review?.summary ?? {};
  const byRisk = s.byRisk ?? ({} as Record<string, number>);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-stone-900">🤝 שימור מטפלים</h1>
            {review && (
              <p className="mt-1 text-sm text-stone-500">
                סקירת השבוע של {fmtDate(review.week_start)} · רצה ב-{fmtDate(review.created_at)}
                {review.acknowledged_at ? ` · אושרה ב-${fmtDate(review.acknowledged_at)}` : ""}
                {s.holidayWeek ? ` · שבוע ${s.holidayWeek}: ירידה בביקוש אצל כולם` : ""}
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
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="קריטי" value={byRisk.critical ?? 0} tone="red" />
              <Stat label="סיכון גבוה" value={byRisk.high ?? 0} tone="amber" />
              <Stat label="סיכון בינוני" value={byRisk.medium ?? 0} tone="yellow" />
              <Stat label="תקינים" value={byRisk.ok ?? 0} tone="green" />
              <Stat label="חדשים / מוקפאים" value={(byRisk.new ?? 0) + (byRisk.paused ?? 0)} />
              <Stat label="פעולות ממתינות" value={pending.filter((p) => p.action_type !== "alert").length} />
            </div>
            {s.benchmark && (
              <p className="mb-6 text-xs text-stone-500">
                הבנצ&apos;מרק (משלם פרטי עם ותק של חודש, {s.benchmark.peers} עמיתים, 30 יום): {s.benchmark.cards} הופעות כרטיס בשאלון · {s.benchmark.opens} כניסות לפרופיל · {s.benchmark.people} פונים.
                {typeof s.onlineShare === "number" ? ` ${Math.round(s.onlineShare * 100)}% מהחיפושים ביקשו אונליין.` : ""}
                {" "}פניות = אנשים שונים, בלי לחיצות חוזרות ובלי אוטומטיות.
              </p>
            )}

            {(["high", "center", "medium"] as ReviewTier[]).map((tier) => {
              const group = byTier[tier];
              if (group.length === 0) return null;
              const attention = group.filter((r) => r.risk !== "ok");
              const fine = group.filter((r) => r.risk === "ok");
              return (
                <section key={tier} className="mb-8">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-stone-500">
                    {TIER_LABELS[tier]} <span className="font-normal text-stone-400">({group.length})</span>
                  </h2>
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                    {attention.length === 0 && <div className="p-4 text-sm text-stone-400">כולם תקינים.</div>}
                    {attention.map((r) => (
                      <RowCard
                        key={r.id}
                        row={r}
                        open={open.has(r.id)}
                        onToggle={() => setOpen((prev) => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                        pendingFor={pendingFor}
                        post={post}
                        onChanged={load}
                      />
                    ))}
                    {fine.length > 0 && (
                      <div className="border-t border-stone-100">
                        <button type="button" onClick={() => setShowOk((p) => ({ ...p, [tier]: !p[tier] }))} className="w-full px-4 py-2 text-start text-xs font-bold text-stone-500 hover:bg-stone-50">
                          {showOk[tier] ? "▾" : "◂"} תקינים ({fine.length})
                        </button>
                        {showOk[tier] &&
                          fine.map((r) => (
                            <RowCard
                              key={r.id}
                              row={r}
                              open={open.has(r.id)}
                              onToggle={() => setOpen((prev) => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                              pendingFor={pendingFor}
                              post={post}
                              onChanged={load}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
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

function Funnel({ m }: { m: ReviewMetrics }) {
  return (
    <span className="text-xs text-stone-500">
      כרטיסים {m.cards_cur}
      {m.cardsBenchmark != null ? <span className="text-stone-400"> / {m.cardsBenchmark}</span> : null}
      {" · "}כניסות {m.opens_cur}
      {" · "}פונים {m.people_21} <span className="text-stone-400">(21 יום)</span>
      {m.certain_cur > 0 ? ` · ${m.certain_cur} הודעות` : ""}
      {m.daysSinceContact != null ? ` · פנייה אחרונה לפני ${m.daysSinceContact} ימים` : " · אף פנייה"}
    </span>
  );
}

function RowCard({
  row, open, onToggle, pendingFor, post, onChanged,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
  pendingFor: (therapistId: string, type: string) => Pending | undefined;
  post: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; status: number; [k: string]: unknown }>;
  onChanged: () => Promise<void>;
}) {
  const m = row.metrics;
  const shownFlags = row.flags.slice(0, 4);
  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-start hover:bg-stone-50">
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${RISK_TONE[row.risk]}`}>{RISK_LABELS[row.risk]}</span>
        <span className="font-bold text-stone-900">{row.name}</span>
        <span className="text-xs text-stone-400">{SOURCE_LABELS[row.promotion_source ?? ""] ?? row.promotion_source}{m.regions.length ? ` · ${m.regions.join(", ")}` : ""}{m.tenureDays < 30 ? ` · ${m.tenureDays} ימים` : ""}</span>
        <span className="basis-full sm:basis-auto sm:ms-auto"><Funnel m={m} /></span>
        <span className="basis-full flex flex-wrap gap-1">
          {shownFlags.map((f) => (
            <span key={f.key} className={`rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold ${OWNER_TONE[f.owner]}`}>{f.label}</span>
          ))}
          {row.flags.length > shownFlags.length && <span className="text-[11px] text-stone-400">+{row.flags.length - shownFlags.length}</span>}
          {row.primary_action && <span className="ms-auto text-[11px] font-bold text-stone-500">{ACTION_ICON[row.primary_action]} {row.actions[0]?.title}</span>}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-stone-100 bg-stone-50/60 px-4 py-4">
          <p className="text-sm text-stone-700">{row.risk_reason}</p>
          <div className="grid gap-2 text-xs text-stone-600 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="הופעות כרטיס (30 יום)" value={`${m.cards_cur}${m.cards_prev ? ` (קודם ${m.cards_prev})` : ""}${m.cardsBenchmark != null ? ` · בנצ'מרק ${m.cardsBenchmark}${m.benchmarkScope === "region" ? " באזור" : ""}` : ""}`} />
            <Metric label="הופעות ברשימות" value={`${m.list_cur}${m.list_prev ? ` (קודם ${m.list_prev})` : ""}`} />
            <Metric label="כניסות לפרופיל" value={`${m.opens_cur}${m.opens_prev ? ` (קודם ${m.opens_prev})` : ""}`} />
            <Metric label="פונים (30 יום)" value={`${m.people_cur}${m.people_prev ? ` (קודם ${m.people_prev})` : ""} · ${m.clicks_cur} לחיצות · ${m.certain_cur} הודעות`} />
            {m.regionCardShare != null && <Metric label="נתח הכרטיסים באזור" value={`${Math.round(m.regionCardShare * 100)}% מתוך ${m.regionPromoted} מקודמים`} />}
            {m.avg_score_cur != null && <Metric label="ציון התאמה ממוצע" value={String(Math.round(m.avg_score_cur))} />}
            {m.paid_cards_cur > 0 && m.cards_cur > 0 && <Metric label="כרטיסים ממבקרים ממומנים" value={`${Math.round((m.paid_cards_cur / m.cards_cur) * 100)}%`} />}
            {m.guaranteeDaysLeft != null && <Metric label="ערבות הפניות" value={`${m.guaranteeContacts} פניות, ${m.guaranteeDaysLeft >= 0 ? `${m.guaranteeDaysLeft} ימים נותרו` : "החלון נסגר"}`} />}
            {m.daysToFirstCharge != null && <Metric label="חיוב ראשון" value={m.daysToFirstCharge >= 0 ? `בעוד ${m.daysToFirstCharge} ימים` : "עבר"} />}
            {m.daysToPromotionEnd != null && <Metric label="סוף הקידום" value={m.daysToPromotionEnd >= 0 ? `בעוד ${m.daysToPromotionEnd} ימים` : "עבר"} />}
            <Metric label="ותק בקידום" value={`${m.tenureDays} ימים`} />
          </div>
          {row.flags.length > 0 && (
            <ul className="space-y-1.5">
              {row.flags.map((f) => (
                <li key={f.key} className="text-sm">
                  <span className={`me-2 text-[11px] font-bold ${OWNER_TONE[f.owner]}`}>{OWNER_LABEL[f.owner]}</span>
                  <span className="font-bold text-stone-800">{f.label}</span>
                  <span className="text-stone-600"> - {f.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {row.actions.map((a, i) => (
              <ActionCard key={`${a.type}-${i}`} row={row} action={a} pending={pendingFor(row.therapist_id, a.type)} post={post} onChanged={onChanged} />
            ))}
            {row.actions.length === 0 && <p className="text-xs text-stone-400">אין פעולה מוצעת.</p>}
          </div>
          <Link href={`/admin/therapists?therapist=${row.therapist_id}`} className="inline-block text-xs font-bold text-stone-500 underline">לכרטיס המטפל/ת באדמין ←</Link>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5">
      <div className="text-[11px] text-stone-400">{label}</div>
      <div className="font-semibold text-stone-700">{value}</div>
    </div>
  );
}

function ActionCard({
  row, action, pending, post, onChanged,
}: {
  row: Row;
  action: ReviewAction;
  pending: Pending | undefined;
  post: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; status: number; [k: string]: unknown }>;
  onChanged: () => Promise<void>;
}) {
  const [subject, setSubject] = useState(pending?.payload?.subject ?? action.subject ?? "");
  const [body, setBody] = useState(pending?.payload?.body ?? action.body ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(payload: Record<string, unknown>, okText: string) {
    if (!pending) return;
    setBusy(true);
    setMsg("");
    try {
      let j = await post({ ...payload, id: pending.id });
      if (!j.ok && j.status === 409 && j.cooled && confirm(`${j.error}\n\nלשלוח בכל זאת?`)) {
        j = await post({ ...payload, id: pending.id, force: true });
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

  const done = !pending && action.type !== "campaign";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-stone-800">{ACTION_ICON[action.type]} {action.title}</span>
        {done && <span className="text-[11px] text-stone-400">אין פעולה ממתינה (בוצע או נדחה)</span>}
      </div>
      <p className="mb-2 text-xs text-stone-500">{action.detail}</p>

      {action.type === "email" && pending && (
        <div className="space-y-2">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm leading-relaxed" />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => run({ action: "email_send", subject, body }, "המייל נשלח.")} className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              שלח ל{row.name}
            </button>
            <button type="button" disabled={busy} onClick={() => run({ action: "dismiss", note: "לא רלוונטי" }, "נדחה.")} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-500">
              לא לשלוח
            </button>
          </div>
        </div>
      )}
      {action.type === "freeze" && pending && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => run({ action: "freeze", days: 7 }, "הוקפא/ה לשבוע.")} className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">❄️ הקפא שבוע</button>
          <button type="button" disabled={busy} onClick={() => run({ action: "freeze", days: 14 }, "הוקפא/ה לשבועיים.")} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 disabled:opacity-50">שבועיים</button>
          <button type="button" disabled={busy} onClick={() => run({ action: "dismiss", note: "לא להקפיא" }, "נדחה.")} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-500">לא</button>
        </div>
      )}
      {action.type === "task" && pending && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => run({ action: "task" }, "נפתחה משימה.")} className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">📞 פתח משימת שיחה</button>
          <button type="button" disabled={busy} onClick={() => run({ action: "dismiss", note: "בלי שיחה" }, "נדחה.")} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-500">לא</button>
        </div>
      )}
      {action.type === "fix" && (
        <div className="flex gap-2">
          <Link href={action.link ?? `/admin/therapists?therapist=${row.therapist_id}`} className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white">🛠️ לכרטיס באדמין</Link>
          {pending && <button type="button" disabled={busy} onClick={() => run({ action: "dismiss", note: "טופל" }, "סומן כטופל.")} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-500">טופל</button>}
        </div>
      )}
      {action.type === "campaign" && (
        <Link href={action.link ?? "/admin/ads"} className="inline-block rounded-full border border-stone-300 px-4 py-1.5 text-xs font-bold text-stone-700">📣 לעמוד הפרסום{action.region ? ` (${action.region})` : ""}</Link>
      )}
      {msg && <p className="mt-2 text-xs text-stone-600">{msg}</p>}
    </div>
  );
}
