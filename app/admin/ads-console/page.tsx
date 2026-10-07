"use client";

import { useEffect, useState } from "react";

// קונסולת גוגל אדס - הצד של גוגל (עלות, CPC, תקציבים, תאריכי סיום - מסונכרן
// לילית ע"י הסקריפט) מול הצד של האתר (סשנים, שאלונים, פונים לפי utm_campaign),
// והמדד שמכריע: עלות לפונה לכל קמפיין. ההתראות הן הצלקות של אוגוסט 2026
// שהפכו לבדיקות אוטומטיות.
//
// "פונה" הוא אדם (סשן) שלחץ על כפתור קשר. עד 7/10/26 העמודה ספרה לחיצות,
// ומי שלחץ שלוש פעמים נספר שלוש פעמים; הלחיצות מוצגות עכשיו בסוגריים.
//
// כל הקומפוננטות מוגדרות ברמת המודול ולא בתוך הרינדור - הלקח מ-/admin/therapists
// (הגדרה פנימית = remount של הכל בכל הקלדה).

type Registry = {
  id?: string;
  google_name: string;
  utm_campaign: string | null;
  budget_type: "daily" | "total";
  budget_amount: number | null;
  end_date: string | null;
  cpc_cap: number | null;
  active: boolean;
  notes: string | null;
};

type Campaign = {
  google_name: string; registered: boolean; utm_campaign: string | null; status: string | null;
  cost7: number; cost30: number; clicks7: number; clicks30: number; impr7: number; impr30: number;
  cpc7: number | null; ctr7: number | null; conv30: number;
  sessions7: number; sessions30: number; quiz30: number; views30: number;
  seekers7: number; seekers30: number; contactClicks30: number; costPerSeeker30: number | null;
  diagnosis: Diagnosis | null;
};

// מה שהעמוד מציג מתוך האבחון (ads-diagnosis.ts): שתי התקופות זו מול זו.
// הנוסח המלא מגיע בגוף ההתראה עצמה.
type Stage = { clicks: number; sessions: number; sawCards: number; quizDone: number; sawResults: number; seekers: number; days: number };
type Diagnosis = {
  tag: string;
  confidence: "high" | "medium" | "low";
  expected: number;
  pZero: number;
  dry: Stage & { from: string };
  baseline: Stage;
};

type Data = {
  registry: Registry[];
  campaigns: Campaign[];
  siteOnly: { utm_campaign: string; sessions: number; seekers: number }[];
  alerts: { severity: "red" | "amber" | "info"; title: string; detail: string }[];
  lastSync: string | null;
  monthlyTarget: number;
  totalCost30: number;
  keywords: {
    capViolations: { campaign: string; keyword: string; clicks: number; cost: number; cpc: number }[];
    topSpenders: { campaign: string; keyword: string; impr: number; clicks: number; cost: number; cpc: number | null; ctr: number | null }[];
    rarelyServed: { campaign: string; count: number }[];
  };
  searchTerms: {
    generic: { campaign: string; term: string; impressions: number; clicks: number; cost: number }[];
    hiddenShare: { campaign: string; cost30: number; hiddenPct: number }[];
    placeless: { campaign: string; pct: number; cost30: number; top: { term: string; cost: number; clicks: number }[] }[];
    hmoFree: { campaign: string; term: string; cost: number; clicks: number }[];
  };
};

const nis = (n: number | null | undefined) => (n == null ? "—" : `₪${n.toLocaleString("he-IL")}`);
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("he-IL"));

const SEV_STYLE: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-stone-200 bg-stone-50 text-stone-600",
};

function AlertsPanel({ alerts }: { alerts: Data["alerts"] }) {
  if (alerts.length === 0)
    return <p className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">✅ אין התראות פתוחות.</p>;
  return (
    <div className="mb-5 space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`rounded-xl border px-4 py-2.5 ${SEV_STYLE[a.severity]}`}>
          <div className="text-sm font-black">{a.title}</div>
          <div className="whitespace-pre-line text-xs leading-5">{a.detail}</div>
        </div>
      ))}
    </div>
  );
}

function MasterTable({ campaigns, totalCost30, monthlyTarget }: { campaigns: Campaign[]; totalCost30: number; monthlyTarget: number }) {
  const hasGoogleData = campaigns.some((c) => c.cost30 > 0);
  return (
    <div className="mb-5 rounded-2xl border-2 border-[#C2DFDE] bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">💰 עלות לפונה לפי קמפיין</h2>
        <span className="text-xs text-stone-400">
          {hasGoogleData ? <>סה״כ 30 יום: <b>{nis(totalCost30)}</b> מול יעד {nis(monthlyTarget)}</> : "נתוני עלות יופיעו אחרי חיבור הסקריפט"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th className="px-2 py-1.5 text-right font-semibold">קמפיין</th>
              <th className="px-2 py-1.5 text-center font-semibold">עלות 30י׳</th>
              <th className="px-2 py-1.5 text-center font-semibold">קליקים</th>
              <th className="px-2 py-1.5 text-center font-semibold">CPC ‏7י׳</th>
              <th className="px-2 py-1.5 text-center font-semibold">CTR ‏7י׳</th>
              <th className="px-2 py-1.5 text-center font-semibold">סשנים 30י׳</th>
              <th className="px-2 py-1.5 text-center font-semibold">שאלונים</th>
              <th className="px-2 py-1.5 text-center font-semibold">פונים 30י׳</th>
              <th className="px-2 py-1.5 text-center font-semibold">₪ לפונה</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.google_name} className="border-b border-stone-100">
                <td className="px-2 py-1.5 text-right font-semibold">
                  {c.google_name}
                  {c.utm_campaign && c.utm_campaign !== c.google_name && <span className="text-xs text-stone-400"> ← {c.utm_campaign}</span>}
                  {!c.registered && <span className="ms-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">לא ברישום</span>}
                </td>
                <td className="px-2 py-1.5 text-center">{c.cost30 > 0 ? nis(c.cost30) : "—"}</td>
                <td className="px-2 py-1.5 text-center">{c.clicks30 > 0 ? num(c.clicks30) : "—"}</td>
                <td className="px-2 py-1.5 text-center">{c.cpc7 != null ? nis(c.cpc7) : "—"}</td>
                <td className="px-2 py-1.5 text-center">{c.ctr7 != null ? `${c.ctr7}%` : "—"}</td>
                <td className="px-2 py-1.5 text-center">{num(c.sessions30)}</td>
                <td className="px-2 py-1.5 text-center">{num(c.quiz30)}</td>
                <td className="px-2 py-1.5 text-center font-bold">
                  {num(c.seekers30)}
                  {c.contactClicks30 > c.seekers30 && <span className="ms-1 text-[11px] font-normal text-stone-400">({num(c.contactClicks30)} לחיצות)</span>}
                </td>
                <td className="px-2 py-1.5 text-center font-black" style={{ color: "var(--teal-dark)" }}>
                  {c.costPerSeeker30 != null ? nis(c.costPerSeeker30) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        פונה = אדם שלחץ על וואטסאפ, חיוג או הודעה למטפל. מי שלחץ כמה פעמים נספר פעם אחת, והלחיצות מופיעות בסוגריים.
      </p>
    </div>
  );
}

const CONFIDENCE: Record<Diagnosis["confidence"], string> = { high: "ביטחון גבוה", medium: "ביטחון בינוני", low: "ביטחון נמוך" };
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

// שתי התקופות של קמפיין שהתייבש, שלב מול שלב. הנוסח והצעדים נמצאים בהתראה;
// כאן רואים את המספרים שמאחוריה, כדי שאפשר יהיה לבדוק את הטענה ולא רק לקרוא אותה.
function DiagnosisPanel({ campaigns }: { campaigns: Campaign[] }) {
  const list = campaigns.filter((c) => c.diagnosis);
  if (list.length === 0) return null;
  const rows: { label: string; key: keyof Stage }[] = [
    { label: "קליקים בגוגל", key: "clicks" },
    { label: "סשנים באתר", key: "sessions" },
    { label: "ראו כרטיסי מטפלים", key: "sawCards" },
    { label: "סיימו שאלון", key: "quizDone" },
    { label: "ראו תוצאות התאמה", key: "sawResults" },
    { label: "פנו למטפל", key: "seekers" },
  ];
  return (
    <div className="mb-5 rounded-2xl border-2 border-[#C2DFDE] bg-white p-5">
      <h2 className="mb-1 text-base font-black text-stone-800">🩺 אבחון: קמפיינים שמוציאים כסף בלי פונים</h2>
      <p className="mb-3 text-xs text-stone-500">
        מה שקרה מאז הפונה האחרון מול התקופה שלפניו. ההסבר והצעדים בהתראה למעלה; האבחון מצביע על הסיבה הסבירה ביותר לפי הנתונים, לא על ודאות.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((c) => {
          const d = c.diagnosis as Diagnosis;
          return (
            <div key={c.google_name} className="rounded-xl border border-stone-200 bg-[var(--surface)] p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-black text-stone-800">{c.google_name}</span>
                <span className="text-xs font-bold" style={{ color: "var(--teal-dark)" }}>{d.tag} · {CONFIDENCE[d.confidence]}</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="py-1 text-right font-semibold">שלב</th>
                    <th className="px-2 py-1 text-center font-semibold">מאז {dayMonth(d.dry.from)} ({d.dry.days} ימים)</th>
                    <th className="px-2 py-1 text-center font-semibold">{d.baseline.days > 0 ? `לפני כן (${d.baseline.days} ימים)` : "לפני כן"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-stone-100">
                      <td className="py-1 text-right text-stone-700">{r.label}</td>
                      <td className={`px-2 py-1 text-center font-bold ${r.key === "seekers" ? "text-red-700" : "text-stone-800"}`}>{num(d.dry[r.key])}</td>
                      <td className="px-2 py-1 text-center text-stone-600">{d.baseline.days > 0 ? num(d.baseline[r.key]) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-stone-600">
                בקצב הקודם היו צפויים <b>{d.expected.toFixed(1)}</b> פונים. הסיכוי לאפס במקרה:{" "}
                <b>{d.pZero < 0.001 ? "פחות מ-0.1%" : d.pZero < 0.01 ? `${(d.pZero * 100).toFixed(1)}%` : `${Math.round(d.pZero * 100)}%`}</b>.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegistryEditor({ registry, onSaved }: { registry: Registry[]; onSaved: (r: Registry[]) => void }) {
  const [rows, setRows] = useState<Registry[]>(registry);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => setRows(registry), [registry]);

  const set = (i: number, patch: Partial<Registry>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/admin-ads-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_registry", rows }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save failed");
      onSaved(json.registry);
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const inp = "w-full rounded border border-stone-300 px-1.5 py-1 text-xs";
  return (
    <div className="mb-5 rounded-2xl border-2 border-[#C2DFDE] bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">📋 רישום קמפיינים</h2>
        <span className="text-xs text-stone-400">העובדות שגוגל מחביאה: סוג תקציב, תאריך סיום, תקרת CPC, וה-utm שהקמפיין מתייג</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-xs">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="px-1.5 py-1.5 text-right font-semibold">שם בגוגל</th>
              <th className="px-1.5 py-1.5 text-right font-semibold">utm_campaign</th>
              <th className="px-1.5 py-1.5 text-center font-semibold">סוג</th>
              <th className="px-1.5 py-1.5 text-center font-semibold">תקציב ₪</th>
              <th className="px-1.5 py-1.5 text-center font-semibold">תאריך סיום</th>
              <th className="px-1.5 py-1.5 text-center font-semibold">תקרת CPC</th>
              <th className="px-1.5 py-1.5 text-center font-semibold">פעיל</th>
              <th className="px-1.5 py-1.5 text-right font-semibold">הערות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.google_name} className="border-b border-stone-100 align-top">
                <td className="px-1.5 py-1.5 font-semibold">{r.google_name}</td>
                <td className="px-1.5 py-1.5"><input className={inp} dir="ltr" value={r.utm_campaign ?? ""} onChange={(e) => set(i, { utm_campaign: e.target.value || null })} /></td>
                <td className="px-1.5 py-1.5">
                  <select className={inp} value={r.budget_type} onChange={(e) => set(i, { budget_type: e.target.value as "daily" | "total" })}>
                    <option value="daily">יומי</option>
                    <option value="total">כולל</option>
                  </select>
                </td>
                <td className="px-1.5 py-1.5"><input className={`${inp} w-20 text-center`} dir="ltr" value={r.budget_amount ?? ""} onChange={(e) => set(i, { budget_amount: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="px-1.5 py-1.5"><input className={`${inp} w-32 text-center`} dir="ltr" type="date" value={r.end_date ?? ""} onChange={(e) => set(i, { end_date: e.target.value || null })} /></td>
                <td className="px-1.5 py-1.5"><input className={`${inp} w-16 text-center`} dir="ltr" value={r.cpc_cap ?? ""} onChange={(e) => set(i, { cpc_cap: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td className="px-1.5 py-1.5 text-center"><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} /></td>
                <td className="px-1.5 py-1.5"><input className={`${inp} min-w-52`} value={r.notes ?? ""} onChange={(e) => set(i, { notes: e.target.value || null })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--teal)" }}
        >
          {state === "saving" ? "שומר..." : "שמירת הרישום"}
        </button>
        {state === "saved" && <span className="text-sm font-semibold text-green-700">✓ נשמר</span>}
        {state === "error" && <span className="text-sm font-semibold text-red-600">השמירה נכשלה - נסו שוב</span>}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { google_name: "", utm_campaign: null, budget_type: "daily", budget_amount: null, end_date: null, cpc_cap: null, active: true, notes: null }])}
          className="rounded-full border px-4 py-2 text-sm font-bold transition hover:bg-stone-50"
          style={{ borderColor: "var(--teal)", color: "var(--teal-dark)" }}
        >
          + שורה
        </button>
      </div>
      {rows.some((r) => !r.google_name) && (
        <p className="mt-2 text-xs text-stone-500">שורה חדשה: להקליד את שם הקמפיין <b>בדיוק כפי שהוא מופיע בגוגל אדס</b> (העמודה Campaign), אחרת ההצלבה לא תתפוס.</p>
      )}
    </div>
  );
}

function KeywordsPanel({ k }: { k: Data["keywords"] }) {
  const empty = k.capViolations.length === 0 && k.topSpenders.length === 0 && k.rarelyServed.length === 0;
  return (
    <div className="mb-5 rounded-2xl border-2 border-[#C2DFDE] bg-white p-5">
      <h2 className="mb-2 text-base font-black text-stone-800">🔑 מילות מפתח (7 ימים)</h2>
      {empty && <p className="text-sm text-stone-500">יופיע אחרי הסנכרון הראשון.</p>}
      {k.capViolations.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-black text-red-700">חריגות מתקרת ה-CPC - התקרה כנראה לא נשמרה:</div>
          {k.capViolations.map((v, i) => (
            <div key={i} className="text-sm">{v.campaign} · <b>{v.keyword}</b> - CPC ‏{nis(v.cpc)} ({v.clicks} קליקים, {nis(v.cost)})</div>
          ))}
        </div>
      )}
      {k.topSpenders.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <div className="mb-1 text-xs font-black text-stone-600">המילים היקרות של השבוע:</div>
          <table className="w-full whitespace-nowrap text-xs">
            <thead><tr className="border-b border-stone-200 text-stone-500">
              <th className="px-2 py-1 text-right font-semibold">מילה</th><th className="px-2 py-1 text-right font-semibold">קמפיין</th>
              <th className="px-2 py-1 text-center font-semibold">חשיפות</th><th className="px-2 py-1 text-center font-semibold">CTR</th>
              <th className="px-2 py-1 text-center font-semibold">קליקים</th><th className="px-2 py-1 text-center font-semibold">עלות</th>
              <th className="px-2 py-1 text-center font-semibold">CPC</th>
            </tr></thead>
            <tbody>
              {k.topSpenders.map((t, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="px-2 py-1 text-right font-semibold">{t.keyword}</td>
                  <td className="px-2 py-1 text-right text-stone-500">{t.campaign}</td>
                  <td className="px-2 py-1 text-center">{num(t.impr)}</td>
                  <td className="px-2 py-1 text-center">{t.ctr != null ? `${t.ctr}%` : "—"}</td>
                  <td className="px-2 py-1 text-center">{num(t.clicks)}</td>
                  <td className="px-2 py-1 text-center">{nis(t.cost)}</td>
                  <td className="px-2 py-1 text-center">{t.cpc != null ? nis(t.cpc) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {k.rarelyServed.length > 0 && (
        <p className="text-xs text-stone-500">
          מילים ש-Google כמעט לא מגישה (rarely served): {k.rarelyServed.map((r) => `${r.campaign} - ${r.count}`).join(" · ")}. לא מזיקות ולא עולות כלום - פשוט אין נפח חיפוש.
        </p>
      )}
    </div>
  );
}

function SearchTermsPanel({ s }: { s: Data["searchTerms"] }) {
  return (
    <div className="mb-5 rounded-2xl border-2 border-[#C2DFDE] bg-white p-5">
      <h2 className="mb-2 text-base font-black text-stone-800">🔍 מונחי חיפוש</h2>
      {s.generic.length === 0 && s.hiddenShare.length === 0 && s.placeless.length === 0 && s.hmoFree.length === 0 && <p className="text-sm text-stone-500">אין דליפות גנריות ידועות. יתעדכן עם הסנכרון.</p>}
      {s.generic.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-black text-red-700">מונחים גנריים שקיבלו חשיפות (לחסום כמילים שליליות):</div>
          {s.generic.map((g, i) => (
            <div key={i} className="text-sm">{g.campaign} · <b>{g.term}</b> - {num(g.impressions)} חשיפות, {g.clicks} קליקים, {nis(g.cost)}</div>
          ))}
        </div>
      )}
      {s.placeless.map((p) => (
        <div key={p.campaign} className="mb-3 rounded-xl bg-amber-50 p-3">
          <div className="mb-1 text-xs font-black text-amber-800">
            🧭 {p.campaign}: {p.pct}% מהתקציב ({nis(p.cost30)}) על חיפושים בלי שם מקום
          </div>
          <div className="text-xs text-stone-600">
            שאילתה כללית מביאה מי שבודק אפשרויות, לא מי שמחפש מטפל בעיר שלו. המובילות:
          </div>
          {p.top.map((t, i) => (
            <div key={i} className="text-sm">· <b>{t.term}</b> - {t.clicks} קליקים, {nis(t.cost)}</div>
          ))}
        </div>
      ))}
      {s.hmoFree.length > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50 p-3">
          <div className="mb-1 text-xs font-black text-amber-800">🏥 מחפשי קופת חולים / טיפול חינם (לחסום כשליליות):</div>
          {s.hmoFree.map((t, i) => (
            <div key={i} className="text-sm">{t.campaign} · <b>{t.term}</b> - {t.clicks} קליקים, {nis(t.cost)}</div>
          ))}
        </div>
      )}
      {s.hiddenShare.length > 0 && (
        <p className="text-xs text-stone-500">
          נתח שאילתות שגוגל מסתירה (Other): {s.hiddenShare.map((h) => `${h.campaign} ~${h.hiddenPct}%`).join(" · ")}. מעל 50% = רוב התקציב בזנב שלא רואים.
        </p>
      )}
    </div>
  );
}

function SyncCard({ lastSync }: { lastSync: string | null }) {
  return (
    <div className="mb-5 rounded-2xl border border-stone-200 bg-[var(--surface)] p-4 text-sm">
      <b>📡 סנכרון מגוגל אדס:</b>{" "}
      {lastSync
        ? <>אחרון ב-{new Date(lastSync).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</>
        : <>טרם חובר. ההתקנה (חד-פעמית, ~5 דקות): Tools ← Scripts בגוגל אדס, להדביק את <code dir="ltr">docs/google-ads-sync.js</code> מהריפו, למלא את הסוד, ולתזמן ריצה יומית. ההוראות המלאות ב-<code dir="ltr">docs/ads-console-setup.md</code>.</>}
      <span className="ms-2 text-xs text-stone-500">הקונסולה קוראת בלבד - כל שינוי בקמפיינים מתבצע ידנית בגוגל אדס.</span>
    </div>
  );
}

export default function AdsConsolePage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin-ads-console", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setData(j)))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div dir="rtl" className="mx-auto max-w-6xl p-4">
      <h1 className="mb-1 text-2xl font-black text-stone-900">גוגל אדס - ניתוח מלא</h1>
      <div className="mb-4 rounded-xl border border-[#C2DFDE] bg-[#EAF4F3] p-3 text-sm text-stone-700">
        <b>מה זה העמוד:</b> הצלבה של ההוצאה בגוגל מול הפונים שנמדדו באתר, ברמת קמפיין, מילת מפתח ומונח חיפוש.{" "}
        <b>לא חייבים להיכנס לכאן:</b> אותן התראות בדיוק נבדקות כל בוקר ב-07:00 ומגיעות אליך לתור הסוכנים ולדוח היומי -{" "}
        <a href="/admin/ads" className="font-black text-[#2A6462] underline">פרסום ממומן</a>. העמוד הזה הוא לצלילה: לראות את המספרים שמאחורי כל התראה, ולערוך את רישום הקמפיינים.
        <br />
        <span className="text-xs text-stone-500">קריאה בלבד מול גוגל - כל שינוי בקמפיינים מתבצע ידנית בגוגל אדס.</span>
      </div>
      {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!data && !err && <p className="text-sm text-stone-500">טוען...</p>}
      {data && (
        <>
          <SyncCard lastSync={data.lastSync} />
          <AlertsPanel alerts={data.alerts} />
          <DiagnosisPanel campaigns={data.campaigns} />
          <MasterTable campaigns={data.campaigns} totalCost30={data.totalCost30} monthlyTarget={data.monthlyTarget} />
          {data.siteOnly.length > 0 && (
            <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
              <b>תנועה ממומנת שאינה משויכת לקמפיין רשום (30 יום):</b>{" "}
              {data.siteOnly.map((s) => `${s.utm_campaign} (${s.sessions} סשנים, ${s.seekers} פונים)`).join(" · ")}
            </div>
          )}
          <RegistryEditor registry={data.registry} onSaved={(r) => setData((d) => (d ? { ...d, registry: r } : d))} />
          <KeywordsPanel k={data.keywords} />
          <SearchTermsPanel s={data.searchTerms} />
        </>
      )}
    </div>
  );
}
