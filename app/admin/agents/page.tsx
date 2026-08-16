"use client";

import { useEffect, useState } from "react";

// עמוד השליטה בסוכנים (גל 1): יומן ריצות, תור ההצעות המאוחד, ותצוגה
// מקדימה של דוח הבוקר. מינימלי בכוונה - מתרחב עם כל סוכן חדש.

type AgentRun = {
  id: string;
  agent: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "empty" | "error";
  mode: string | null;
  summary: string | null;
  error: string | null;
};

type PendingAction = {
  id: string;
  agent: string;
  action_type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_label: string | null;
  created_at: string;
};

type ResolvedAction = {
  id: string;
  agent: string;
  title: string;
  status: string;
  status_changed_at: string | null;
};

type DigestSection = {
  key: string;
  label: string;
  count: number;
  urgent: boolean;
  lines: string[];
  link: string;
};

type DigestPreview = {
  empty: boolean;
  sections: DigestSection[];
  ai_summary: string | null;
  recipients: string[];
};

type LatestDigest = {
  started_at: string;
  status: string;
  sections: DigestSection[];
  ai_summary: string | null;
};

// POST אחיד מול ה-API - בודק גם HTTP וגם ok, ומחזיר שגיאה קריאה אחת
// (ממצא ביקורת: ההנדלרים הועתקו ארבע פעמים וכשל PATCH נבלע בשקט).
async function postAgents(action: string, extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/admin-agents", {
    method: action === "resolve" ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "resolve" ? extra : { action, ...extra }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.ok !== true) {
    throw new Error(String(j.error ?? `שגיאה (${res.status})`));
  }
  return j;
}

type WatchdogCheck = {
  key: string;
  label: string;
  ok: boolean;
  skipped?: boolean;
  detail: string;
  ms: number;
};

type WatchdogRun = {
  checks: WatchdogCheck[];
  failures: number;
};

type PendingConversion = {
  payment_id: string;
  payment_type: string;
  value_ils: number;
  paid_at: string;
  click_id_kind: string;
};

type ConversionsPreview = {
  configured: boolean;
  actions_ready: boolean;
  pending: PendingConversion[];
};

type AdsRun = {
  configured: boolean;
  findings: { key: string; severity: string; title: string; detail: string }[];
  campaigns: { name: string; utm: string | null; cost: number; clicks: number; contacts: number; cpl: number | null }[];
  spend_mtd: number;
  budget_pace: { expected: number; actual: number } | null;
};

const AGENT_LABELS: Record<string, string> = {
  daily_digest: "בקר הבוקר",
  watchdog: "שומר הלילה",
  conversions: "המרות לגוגל",
  ads: "סוכן הפרסום",
};

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: "תקין", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  empty: { label: "אין חדש", cls: "bg-stone-50 border-stone-200 text-stone-500" },
  error: { label: "שגיאה", cls: "bg-red-50 border-red-200 text-red-700" },
  running: { label: "רץ...", cls: "bg-blue-50 border-blue-200 text-blue-700" },
};

function agentLabel(agent: string): string {
  return AGENT_LABELS[agent] ?? agent;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export default function AgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [resolved, setResolved] = useState<ResolvedAction[]>([]);
  const [latestDigest, setLatestDigest] = useState<LatestDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [previewError, setPreviewError] = useState("");

  const [watchdogLoading, setWatchdogLoading] = useState(false);
  const [watchdog, setWatchdog] = useState<WatchdogRun | null>(null);
  const [watchdogError, setWatchdogError] = useState("");

  const [adsLoading, setAdsLoading] = useState(false);
  const [ads, setAds] = useState<AdsRun | null>(null);
  const [adsError, setAdsError] = useState("");

  const [convLoading, setConvLoading] = useState(false);
  const [conv, setConv] = useState<ConversionsPreview | null>(null);
  const [convError, setConvError] = useState("");
  const [convMsg, setConvMsg] = useState("");

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin-agents")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setRuns(j.runs ?? []);
          setPending(j.pending_actions ?? []);
          setResolved(j.resolved_actions ?? []);
          setLatestDigest(j.latest_digest ?? null);
        } else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function runPreview() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const j = await postAgents("digest_preview");
      setPreview(j as unknown as DigestPreview);
      load(); // הריצה נרשמת ביומן
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "שגיאה בהפקת התצוגה המקדימה");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runWatchdogNow() {
    setWatchdogLoading(true);
    setWatchdogError("");
    setWatchdog(null);
    try {
      const j = await postAgents("watchdog_run");
      setWatchdog(j as unknown as WatchdogRun);
      load();
    } catch (e) {
      setWatchdogError(e instanceof Error ? e.message : "שגיאה בהרצת הבדיקות");
    } finally {
      setWatchdogLoading(false);
    }
  }

  async function runAdsNow() {
    setAdsLoading(true);
    setAdsError("");
    setAds(null);
    try {
      const j = await postAgents("ads_run");
      setAds(j as unknown as AdsRun);
      load();
    } catch (e) {
      setAdsError(e instanceof Error ? e.message : "שגיאה בניטור הפרסום");
    } finally {
      setAdsLoading(false);
    }
  }

  async function conversionsPreview() {
    setConvLoading(true);
    setConvError("");
    setConvMsg("");
    try {
      const j = await postAgents("conversions_preview");
      setConv(j as unknown as ConversionsPreview);
      load();
    } catch (e) {
      setConvError(e instanceof Error ? e.message : "שגיאה בתצוגה המקדימה");
    } finally {
      setConvLoading(false);
    }
  }

  async function conversionsSetup() {
    if (!window.confirm("להקים בחשבון Google Ads שתי פעולות המרה (רכישת שאלון, מנוי מטפל)? זו פעולה חד-פעמית בחשבון הפרסום.")) return;
    setConvLoading(true);
    setConvError("");
    setConvMsg("");
    try {
      const j = await postAgents("conversions_setup");
      setConvMsg("פעולות ההמרה קיימות בחשבון ✓");
      setConv(conv ? { ...conv, actions_ready: Boolean(j.actions_ready) } : conv);
      load();
    } catch (e) {
      setConvError(e instanceof Error ? e.message : "שגיאה בהקמה");
    } finally {
      setConvLoading(false);
    }
  }

  async function resolveAction(id: string, status: "approved" | "dismissed" | "pending") {
    setBusyId(id);
    setActionError("");
    try {
      await postAgents("resolve", { id, status });
      load();
    } catch (e) {
      // כשל מוצג במקום להיבלע - למשל "החזר" כשכבר קיימת הצעה זהה ממתינה.
      setActionError(e instanceof Error ? e.message : "הפעולה נכשלה");
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-black text-stone-900 mb-2">סוכנים אוטונומיים</h1>
        <p className="text-sm text-stone-500 mb-6">
          מרכז השליטה בסוכני האוטומציה: יומן הריצות, תור ההצעות, ותצוגה מקדימה של דוח הבוקר.
          שום סוכן לא שולח מייל או מבצע פעולה בלי אישור.
        </p>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        {/* בקר הבוקר */}
        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="font-black text-stone-900">☀️ בקר הבוקר</h2>
            <button
              onClick={runPreview}
              disabled={previewLoading}
              className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {previewLoading ? "מפיק..." : "הצג תצוגה מקדימה"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            רץ כל בוקר ושומר את הדוח כאן בעמוד. המיילים כבויים בכוונה (החלטה 16/8) - הכול
            נצפה ישירות למטה. הכפתור מפיק דוח טרי ברגע זה.
          </p>

          {latestDigest && !preview && (
            <div className="mb-4">
              <div className="text-xs font-bold text-stone-400 mb-2">
                הדוח האחרון · {fmtDateTime(latestDigest.started_at)}
              </div>
              {latestDigest.status === "empty" || latestDigest.sections.length === 0 ? (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                  בריצה האחרונה לא היה אף פריט שדורש תשומת לב.
                </div>
              ) : (
                <div className="space-y-3">
                  {latestDigest.ai_summary && (
                    <div className="rounded-xl bg-[#EAF4F3] p-4 text-sm text-[#2A6462] leading-7 whitespace-pre-line">
                      {latestDigest.ai_summary}
                    </div>
                  )}
                  {latestDigest.sections.map((s) => (
                    <div key={s.key} className="rounded-xl border border-stone-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-stone-900 text-sm">
                          {s.label} ({s.count})
                        </span>
                        {s.urgent && (
                          <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                            דורש טיפול
                          </span>
                        )}
                      </div>
                      <ul className="list-disc ps-5 text-sm text-stone-600 leading-6">
                        {s.lines.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {previewError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
              {previewError}
            </div>
          )}

          {preview && preview.empty && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
              אין כרגע אף פריט שדורש תשומת לב - ביום כזה לא נשלח מייל בכלל.
            </div>
          )}

          {preview && !preview.empty && (
            <div className="space-y-4">
              {preview.ai_summary && (
                <div className="rounded-xl bg-[#EAF4F3] p-4 text-sm text-[#2A6462] leading-7 whitespace-pre-line">
                  {preview.ai_summary}
                </div>
              )}
              {preview.sections.map((s) => (
                <div key={s.key} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-stone-900 text-sm">
                      {s.label} ({s.count})
                    </span>
                    {s.urgent && (
                      <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                        דורש טיפול
                      </span>
                    )}
                  </div>
                  <ul className="list-disc ps-5 text-sm text-stone-600 leading-6">
                    {s.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-stone-400">
                כשיחומש, המייל יישלח אל: {preview.recipients.join(", ")}
              </p>
            </div>
          )}
        </section>

        {/* שומר הלילה */}
        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="font-black text-stone-900">🌙 שומר הלילה</h2>
            <button
              onClick={runWatchdogNow}
              disabled={watchdogLoading}
              className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {watchdogLoading ? "בודק..." : "הרץ בדיקות עכשיו"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            בדיקות תקינות ליליות של האתר החי: שאלונים, ניקוד, התאמה, עמודי מפתח, אנליטיקה
            וטריות הקרונים. כישלון נכנס לתור ההצעות; מייל התראה מיידי יחומש יחד עם דוח הבוקר.
          </p>

          {watchdogError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
              {watchdogError}
            </div>
          )}

          {watchdog && (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-sm" dir="rtl">
                <tbody>
                  {watchdog.checks.map((c) => (
                    <tr key={c.key} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {c.skipped ? "⏭️" : c.ok ? "✅" : "❌"}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-stone-700 whitespace-nowrap">{c.label}</td>
                      <td className="px-3 py-1.5 text-stone-500">{c.detail}</td>
                      <td className="px-3 py-1.5 text-stone-400 text-xs whitespace-nowrap">
                        {c.ms > 0 ? `${(c.ms / 1000).toFixed(1)}s` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* סוכן הפרסום */}
        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="font-black text-stone-900">📣 סוכן הפרסום</h2>
            <button
              onClick={runAdsNow}
              disabled={adsLoading}
              className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {adsLoading ? "בודק..." : "הרץ ניטור עכשיו"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            מצליב כל בוקר את ההוצאה בגוגל מול המשפך הפנימי: קמפיין ששורף כסף בלי לחיצות פנייה,
            עלות מעל היעד, חריגה מקצב התקציב, וקמפיין בלי utm שאי אפשר למדוד. קריאה בלבד -
            הסוכן לא נוגע בקמפיינים, רק מציע.
          </p>

          {adsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">{adsError}</div>
          )}

          {ads && !ads.configured && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
              חיבור Google Ads לא מוגדר בסביבה הזו.
            </div>
          )}

          {ads && ads.configured && (
            <div className="space-y-3">
              {ads.budget_pace && (
                <div className="text-xs text-stone-500">
                  הוצאה החודש: <strong>₪{ads.spend_mtd.toLocaleString("he-IL")}</strong> · לפי הקצב המתוכנן:
                  ₪{ads.budget_pace.expected.toLocaleString("he-IL")}
                </div>
              )}
              {ads.findings.length === 0 ? (
                <p className="text-sm text-stone-500">אין ממצאים - הקמפיינים בטווח הנורמה.</p>
              ) : (
                ads.findings.map((f) => (
                  <div
                    key={f.key}
                    className={`rounded-xl border p-4 ${f.severity === "high" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
                  >
                    <div className="font-bold text-sm text-stone-900 mb-1">{f.title}</div>
                    <div className="text-sm text-stone-600 leading-6">{f.detail}</div>
                  </div>
                ))
              )}
              {ads.campaigns.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-right text-xs text-stone-500">
                        <th className="px-3 py-2 font-bold">קמפיין</th>
                        <th className="px-3 py-2 font-bold">הוצאה (7 ימים)</th>
                        <th className="px-3 py-2 font-bold">קליקים</th>
                        <th className="px-3 py-2 font-bold">לחיצות פנייה</th>
                        <th className="px-3 py-2 font-bold">עלות ללחיצה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ads.campaigns.map((c) => (
                        <tr key={c.name} className="border-b border-stone-100 last:border-0">
                          <td className="px-3 py-1.5 font-bold text-stone-700">
                            {c.name}
                            {!c.utm && <span className="text-red-600 text-xs"> (בלי utm)</span>}
                          </td>
                          <td className="px-3 py-1.5 text-stone-600">₪{c.cost.toLocaleString("he-IL")}</td>
                          <td className="px-3 py-1.5 text-stone-500">{c.clicks}</td>
                          <td className={`px-3 py-1.5 font-bold ${c.contacts === 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {c.contacts}
                          </td>
                          <td className="px-3 py-1.5 text-stone-600">{c.cpl != null ? `₪${c.cpl}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* המרות לגוגל */}
        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="font-black text-stone-900">📈 המרות אמת לגוגל</h2>
            <button
              onClick={conversionsPreview}
              disabled={convLoading}
              className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {convLoading ? "בודק..." : "תצוגה מקדימה"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            מדווח לגוגל על תשלומים אמיתיים שהגיעו מקליק ממומן (דרך מזהה הקליק בלבד - בלי שום פרט
            אישי), כדי שהאופטימיזציה תרדוף לקוחות משלמים. רץ יומית בתצוגה מקדימה; העלאה אמיתית רק
            אחרי הקמת פעולות ההמרה וחימוש.
          </p>

          {convError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">{convError}</div>
          )}
          {convMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 mb-3">{convMsg}</div>
          )}

          {conv && !conv.configured && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
              חיבור Google Ads לא מוגדר בסביבה הזו.
            </div>
          )}

          {conv && conv.configured && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${conv.actions_ready ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                  {conv.actions_ready ? "פעולות ההמרה קיימות בחשבון ✓" : "פעולות ההמרה טרם הוקמו"}
                </span>
                {!conv.actions_ready && (
                  <button
                    onClick={conversionsSetup}
                    disabled={convLoading}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    הקם פעולות המרה בגוגל
                  </button>
                )}
              </div>
              {conv.pending.length === 0 ? (
                <p className="text-sm text-stone-500">
                  אין כרגע תשלומים עם מזהה קליק שממתינים להעלאה - הצינור מוכן וימלא את עצמו ברגע
                  שלקוח משלם יגיע מקליק ממומן.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-right text-xs text-stone-500">
                        <th className="px-3 py-2 font-bold">סוג</th>
                        <th className="px-3 py-2 font-bold">סכום</th>
                        <th className="px-3 py-2 font-bold">תאריך תשלום</th>
                        <th className="px-3 py-2 font-bold">מזהה קליק</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conv.pending.map((p) => (
                        <tr key={p.payment_id} className="border-b border-stone-100 last:border-0">
                          <td className="px-3 py-1.5 font-bold text-stone-700">{p.payment_type === "quiz" ? "שאלון" : "מנוי מטפל"}</td>
                          <td className="px-3 py-1.5 text-stone-600">₪{p.value_ils}</td>
                          <td className="px-3 py-1.5 text-stone-500">{fmtDateTime(p.paid_at)}</td>
                          <td className="px-3 py-1.5 text-stone-400 text-xs">{p.click_id_kind}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* תור ההצעות */}
        <section className="mb-8">
          <h2 className="text-sm font-black text-stone-500 mb-3">
            הצעות ממתינות לאישור ({pending.length})
          </h2>
          {actionError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 mb-3">
              {actionError}
            </div>
          )}
          {loading && <p className="text-sm text-stone-400">טוען...</p>}
          {!loading && pending.length === 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-400">
              אין הצעות ממתינות. כשסוכן יציע פעולה (טיוטת מייל, המלצה, התראה) - היא תופיע כאן
              לאישור או דחייה.
            </div>
          )}
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-black text-stone-900 text-sm">{a.title}</h3>
                  <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-bold text-stone-500">
                    {agentLabel(a.agent)}
                  </span>
                </div>
                {a.entity_label && <p className="text-xs text-stone-400 mb-1">{a.entity_label}</p>}
                {a.body && <p className="text-sm text-stone-600 leading-6 whitespace-pre-line">{a.body}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolveAction(a.id, "approved")}
                    disabled={busyId === a.id}
                    className="rounded-full bg-[#2e7d8c] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ✓ אשר
                  </button>
                  <button
                    onClick={() => resolveAction(a.id, "dismissed")}
                    disabled={busyId === a.id}
                    className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    ✕ דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
          {resolved.length > 0 && (
            <div className="mt-4 space-y-1">
              <h3 className="text-xs font-black text-stone-400 mb-1">הוכרעו לאחרונה</h3>
              {resolved.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-100 pb-1"
                >
                  <span>
                    {a.status === "approved" ? "✓" : "✕"} {a.title}
                  </span>
                  <button
                    onClick={() => resolveAction(a.id, "pending")}
                    disabled={busyId === a.id}
                    className="underline hover:text-stone-600 disabled:opacity-50"
                  >
                    החזר
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* יומן ריצות */}
        <section>
          <h2 className="text-sm font-black text-stone-500 mb-3">יומן ריצות</h2>
          {!loading && runs.length === 0 && (
            <p className="text-sm text-stone-400">עדיין אין ריצות - הקרון ירוץ מחר בבוקר, או הפק תצוגה מקדימה עכשיו.</p>
          )}
          {runs.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-right text-xs text-stone-500">
                    <th className="px-4 py-2 font-bold">סוכן</th>
                    <th className="px-4 py-2 font-bold">מתי</th>
                    <th className="px-4 py-2 font-bold">מצב</th>
                    <th className="px-4 py-2 font-bold">סטטוס</th>
                    <th className="px-4 py-2 font-bold">סיכום</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const st = RUN_STATUS[r.status] ?? RUN_STATUS.running;
                    return (
                      <tr key={r.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-2 font-bold text-stone-700 whitespace-nowrap">
                          {agentLabel(r.agent)}
                        </td>
                        <td className="px-4 py-2 text-stone-500 whitespace-nowrap">
                          {fmtDateTime(r.started_at)}
                        </td>
                        <td className="px-4 py-2 text-stone-500 whitespace-nowrap">
                          {r.mode === "send" ? "שליחה" : r.mode === "preview" ? "תצוגה מקדימה" : ""}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {r.error ? <span className="text-red-600">{r.error}</span> : r.summary}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
