"use client";

import { useCallback, useEffect, useState } from "react";

// SEO אורגני - פילוח "ביקוש מול חיפוש-שם". השאלה שהעמוד עונה עליה: כמה
// מהתנועה האורגנית היא אנשים שחיפשו *טיפול* (עיר/גישה/נושא - הנכס שה-SEO
// אמור להביא), וכמה חיפשו *מטפל ספציפי בשמו* ופשוט נחתו על הפרופיל אצלנו.
// המספר הכולל של "אורגני" מטעה - הוא נשלט ע"י חיפושי שם.

type WeekRow = { week: string; demand: number; name: number; recruit: number; other: number };
type KindRow = { kind: string; sessions: number; viewed: number; quiz: number; contacts: number; certain: number };
type PageRow = { page: string; sessions: number; quiz: number; contacts: number };
type NameRow = { name: string; status: string; sessions: number };
type FunnelRow = { grp: string; sessions: number; viewed: number; quiz: number; contacts: number; certain: number };

type SeoData = {
  since: string;
  window_days: number;
  contacts_since: string;
  weekly: WeekRow[];
  totals: { sessions: number; demand: number; name: number; recruit: number; other: number };
  kinds: KindRow[];
  demand_pages: PageRow[];
  name_top: NameRow[];
  name_breadth: { therapists: number; sessions: number };
  funnel: FunnelRow[];
};

const KIND_LABELS: Record<string, string> = {
  profile: "פרופיל מטפל (חיפוש שם)",
  quiz: "שאלון התאמה",
  directory: "מאגר המטפלים",
  city: "עמודי עיר",
  city_topic: "עיר + נושא",
  region: "עמודי אזור",
  online: "עמוד אונליין",
  online_topic: "אונליין + נושא",
  specialty: "עמודי גישה טיפולית",
  topic: "עמודי נושא",
  assessment: "עמודי אבחונים",
  arrangement: "עמודי הסדרים",
  research: "מאמרים",
  para_medical: "מאגר פארא-רפואי",
  recruit: "גיוס מטפלים",
  other: "אחר",
};

// "city:חיפה" → "עיר: חיפה" - תווית קריאה לעמוד נחיתה בודד.
function pageLabel(page: string): string {
  const [prefix, ...rest] = page.split(":");
  const val = rest.join(":");
  const map: Record<string, string> = {
    city: "עיר", city_topic: "עיר+נושא", region: "אזור", specialty: "גישה",
    topic: "נושא", online_topic: "אונליין+נושא", assessment: "אבחון",
    arrangement: "הסדר", research: "מאמר",
  };
  if (page === "directory") return "מאגר המטפלים";
  if (page === "para-medical") return "מאגר פארא-רפואי";
  if (page === "region:online") return "עמוד אונליין";
  return map[prefix] ? `${map[prefix]}: ${val.replace(/-/g, " ")}` : page;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
const rate = (part: number, whole: number) => (whole > 0 ? (100 * part / whole).toFixed(1) : "0");

export default function AdminSeoPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback((d: number) => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-seo?days=${d}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j.data);
        else setError(j.error ?? "שגיאה");
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(days), [load, days]);

  const t = data?.totals;
  const patientSessions = t ? t.sessions - t.recruit - t.other : 0; // מטופלים בלבד
  const demandConv = data?.funnel.find((c) => c.grp === "demand");
  const nameConv = data?.funnel.find((c) => c.grp === "name");
  const maxWeek = Math.max(1, ...(data?.weekly ?? []).map((w) => w.demand + w.name + w.recruit + w.other));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-stone-900">SEO אורגני - ביקוש מול חיפוש שם</h1>
        <div className="flex gap-1.5">
          {[30, 60, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                days === d ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-600 hover:bg-stone-50"}`}>
              {d} יום
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 max-w-3xl text-sm leading-6 text-stone-500">
        כניסה אורגנית שנחתה <strong>ישר על פרופיל מטפל</strong> (בלי עמוד רשימה לפניה) היא כמעט תמיד חיפוש
        של שם המטפל - 98% מהסשנים האלה צופים במטפל אחד בלבד. כניסה שנחתה על עמוד עיר/גישה/מאגר/שאלון היא
        <strong> ביקוש אמיתי לטיפול</strong> - הנכס שה-SEO אמור לייצר. הסיווג לפי הנגיעה הראשונה בכל סשן.
      </p>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-stone-400 animate-pulse">טוען…</p>}

      {!loading && data && t && (
        <>
          {/* KPI */}
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="text-2xl font-black text-[#0F5468]">{t.demand}</div>
              <div className="text-xs font-bold text-stone-600">ביקוש אמיתי</div>
              <div className="text-[11px] text-stone-400">{pct(t.demand, patientSessions)}% מסשני מטופלים · {demandConv ? `${rate(demandConv.quiz, demandConv.sessions)}% מילאו שאלון` : ""}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-2xl font-black text-amber-800">{t.name}</div>
              <div className="text-xs font-bold text-stone-600">חיפוש שם מטפל</div>
              <div className="text-[11px] text-stone-400">{pct(t.name, patientSessions)}% מסשני מטופלים · {nameConv ? `${rate(nameConv.contacts, nameConv.sessions)}% לחצו ליצירת קשר` : ""}</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="text-2xl font-black text-stone-800">{data.name_breadth.therapists}</div>
              <div className="text-xs font-bold text-stone-600">מטפלים עם חיפושי שם</div>
              <div className="text-[11px] text-stone-400">נכס מכירתי: "הפרופיל שלך מדורג בגוגל"</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="text-2xl font-black text-stone-800">{t.recruit}</div>
              <div className="text-xs font-bold text-stone-600">גיוס מטפלים</div>
              <div className="text-[11px] text-stone-400">קהל נפרד - לא מטופלים</div>
            </div>
          </div>

          {/* מגמה שבועית */}
          <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="mb-1 text-base font-black text-stone-700">מגמה שבועית (מאז {new Date(data.since + "T00:00:00").toLocaleDateString("he-IL")})</h2>
            <p className="mb-4 text-xs text-stone-400">
              <span className="ms-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3D8C8A]" /> ביקוש</span>
              <span className="ms-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> חיפוש שם</span>
              <span className="ms-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-stone-300" /> גיוס/אחר</span>
            </p>
            <div className="flex items-end gap-2" style={{ height: "150px" }}>
              {data.weekly.map((w) => {
                const total = w.demand + w.name + w.recruit + w.other;
                return (
                  <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1" title={`שבוע ${new Date(w.week + "T00:00:00").toLocaleDateString("he-IL")}: ביקוש ${w.demand} · שם ${w.name} · גיוס ${w.recruit}`}>
                    <div className="text-[10px] font-bold text-stone-500">{total}</div>
                    <div className="flex w-full max-w-[46px] flex-col overflow-hidden rounded-t-md" style={{ height: `${(100 * total) / maxWeek}%`, minHeight: total > 0 ? "6px" : "0" }}>
                      <div className="w-full bg-stone-300" style={{ flexGrow: w.recruit + w.other }} />
                      <div className="w-full bg-amber-400" style={{ flexGrow: w.name }} />
                      <div className="w-full bg-[#3D8C8A]" style={{ flexGrow: w.demand }} />
                    </div>
                    <div className="text-[10px] text-stone-400">{new Date(w.week + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-stone-400">
              הפס הירקרק (ביקוש) הוא המדד היחיד שאומר אם ה-SEO עובד. הפס הענברי (חיפושי שם) יגדל עם כל מטפל
              שמצטרף - גם בלי שום שיפור בדירוג.
            </p>
          </section>

          {/* המשפך המלא - שתי הקבוצות ממירות בערוצים שונים */}
          <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="mb-1 text-base font-black text-stone-700">המשפך עד הפנייה למטפל ({days} יום)</h2>
            <p className="mb-4 text-xs leading-5 text-stone-500">
              שתי הקבוצות ממירות אחרת: מי שהגיע מ<strong>ביקוש</strong> ("פסיכולוג בחיפה") לרוב ממלא קודם שאלון,
              ולעיתים חוזר ליצור קשר רק בביקור אחר. מי שחיפש <strong>שם</strong> מדלג על השאלון ולוחץ ישירות.
              לכן מדידה לפי לחיצת-קשר בלבד מציגה את הביקוש כחלש ממה שהוא.
            </p>
            <div className="space-y-4">
              {(["demand", "name"] as const).map((grp) => {
                const f = data.funnel.find((x) => x.grp === grp);
                if (!f) return null;
                const isDemand = grp === "demand";
                const color = isDemand ? "#3D8C8A" : "#D49018";
                const steps = [
                  { label: "כניסות", n: f.sessions },
                  { label: "צפו בפרופיל מטפל", n: f.viewed },
                  { label: "השלימו שאלון התאמה", n: f.quiz },
                  { label: "לחצו ליצירת קשר", n: f.contacts },
                ];
                return (
                  <div key={grp}>
                    <div className="mb-1.5 text-sm font-black" style={{ color: isDemand ? "#0F5468" : "#A87010" }}>
                      {isDemand ? "🌱 ביקוש (עיר / גישה / נושא / מאגר / שאלון)" : "🔎 חיפוש שם מטפל"}
                    </div>
                    <div className="flex flex-wrap items-stretch gap-1.5">
                      {steps.map((s, i) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-stone-300">←</span>}
                          <div className="rounded-xl border px-3 py-2 text-center"
                            style={{ borderColor: color + "55", background: color + "0F", minWidth: "104px" }}>
                            <div className="text-lg font-black" style={{ color: isDemand ? "#0F5468" : "#A87010" }}>{s.n}</div>
                            <div className="text-[11px] text-stone-500">{s.label}</div>
                            {i > 0 && <div className="text-[10px] text-stone-400">{rate(s.n, f.sessions)}% מהכניסות</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-stone-400">
                      מתוך {f.contacts} לחיצות הקשר: <strong>{f.certain}</strong> הודעות שנשלחו בפועל דרך האתר (פנייה ודאית),
                      {" "}{f.contacts - f.certain} טלפון/וואטסאפ (כוונה - לא ידוע אם התקיימה שיחה).
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
              ⚠️ שיוך לחיצות-קשר לסשן קיים רק מ-{new Date(data.contacts_since + "T00:00:00").toLocaleDateString("he-IL")}.
              לחיצות שקדמו לתאריך הזה לא ניתנות לשיוך, ולכן בחלון של 90 יום שיעורי הלחיצות נמוכים מהאמת.
              לתמונה מדויקת - בחרו 30 יום.
            </p>
          </section>

          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            {/* סוגי נחיתה */}
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="mb-3 text-base font-black text-stone-700">לפי סוג עמוד הנחיתה ({days} יום)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-400">
                    <th className="pb-2 text-right font-semibold">סוג</th>
                    <th className="pb-2 text-left font-semibold">סשנים</th>
                    <th className="pb-2 text-left font-semibold" title="השלימו שאלון התאמה">שאלון</th>
                    <th className="pb-2 text-left font-semibold" title="סשנים עם לחיצת יצירת קשר">קשר</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kinds.map((k) => (
                    <tr key={k.kind} className="border-b border-stone-100">
                      <td className="py-1.5 text-stone-700">
                        {k.kind === "profile" ? <strong>{KIND_LABELS[k.kind]}</strong> : KIND_LABELS[k.kind] ?? k.kind}
                      </td>
                      <td className="py-1.5 text-left font-bold text-stone-800">{k.sessions}</td>
                      <td className="py-1.5 text-left text-stone-600">{k.quiz > 0 ? `${k.quiz} (${rate(k.quiz, k.sessions)}%)` : "-"}</td>
                      <td className="py-1.5 text-left text-stone-600">{k.contacts > 0 ? `${k.contacts} (${rate(k.contacts, k.sessions)}%)` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* עמודי ביקוש מובילים */}
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="mb-3 text-base font-black text-stone-700">עמודי הביקוש שהביאו כניסות ({days} יום)</h2>
              {data.demand_pages.length === 0 ? (
                <p className="text-sm text-stone-400">אין נתונים בחלון הזה</p>
              ) : (
                <div className="space-y-1.5">
                  {data.demand_pages.map((p) => {
                    const max = data.demand_pages[0]?.sessions ?? 1;
                    return (
                      <div key={p.page} className="flex items-center gap-2 text-sm"
                        title={`${p.page} · ${p.quiz} השלימו שאלון · ${p.contacts} לחצו ליצירת קשר`}>
                        <div className="w-40 truncate text-stone-700">{pageLabel(p.page)}</div>
                        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-[#3D8C8A]" style={{ width: `${(100 * p.sessions) / max}%` }} />
                        </div>
                        <div className="w-7 text-left text-xs font-bold text-stone-600">{p.sessions}</div>
                        <div className="w-12 text-left text-[11px] text-stone-400">
                          {p.quiz > 0 && <span title="השלימו שאלון">✎{p.quiz}</span>}
                          {p.contacts > 0 && <span className="ms-1 text-teal-700" title="לחצו ליצירת קשר">✆{p.contacts}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-5 text-stone-400">
                שאלון ומאגר לא מופיעים כאן - הרשימה מציגה רק עמודי SEO ייעודיים (עיר/גישה/נושא/אזור).
              </p>
            </section>
          </div>

          {/* חיפושי שם */}
          <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
            <h2 className="mb-1 text-base font-black text-stone-700">חיפושי שם - מי מחפשים ({days} יום)</h2>
            <p className="mb-3 text-xs leading-5 text-stone-500">
              {data.name_breadth.sessions} סשנים נחתו ישר על פרופיל, על פני {data.name_breadth.therapists} מטפלים שונים.
              המרה: {nameConv ? rate(nameConv.contacts, nameConv.sessions) : 0}% (גבוהה מביקוש - הם כבר החליטו).
              זה ערך אמיתי למטפל המשלם, אבל הוא לא מעיד על דירוג עמודי הביקוש.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.name_top.map((n) => (
                <span key={n.name} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                  {n.name} <span className="font-black text-amber-800">{n.sessions}</span>
                  {n.status === "paying" && <span className="ms-1 text-[10px] text-teal-700">· משלם</span>}
                </span>
              ))}
            </div>
          </section>

          {/* מגבלות ומקורות */}
          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-xs leading-6 text-stone-500">
            <h2 className="mb-1 text-sm font-black text-stone-700">מה חשוב לדעת על המדידה</h2>
            <ul className="list-inside list-disc space-y-1">
              <li><strong>מילות החיפוש עצמן</strong> נמצאות רק ב-Google Search Console (ביצועים ← שאילתות) - שם רואים במפורש אם "פסיכולוג בחיפה" מביא הקלקות. העמוד הזה מסיק מהתנהגות, לא מהשאילתה.</li>
              <li><strong>&quot;פנייה&quot; מול &quot;לחיצה&quot;:</strong> רק הודעה שנשלחה דרך האתר היא פנייה ודאית. טלפון ווואטסאפ הם לחיצות - מדד כוונה שאינו מוכיח ששיחה התקיימה. שני המספרים מוצגים בנפרד במשפך.</li>
              <li><strong>המרה מאוחרת אינה נספרת:</strong> מי שמילא שאלון, יצא, וחזר כעבור יומיים ליצור קשר - נספר כשני סשנים נפרדים, והפנייה תיוחס לביקור השני (לרוב &quot;ישיר&quot;). לכן שיעור לחיצות-הקשר של הביקוש הוא רצפה, לא תקרה.</li>
              <li><strong>הטיה אפשרית:</strong> מבקר חוזר שנכנס ישירות לפרופיל אחרי שפג הסשן ייספר כחיפוש שם. ההיקף מוגבל (98% מהסשנים האלה חד-מטפליים).</li>
              <li><strong>מאמרים:</strong> מעקב הכניסות למאמרים נוסף ב-6/8/26 - נתוני "מאמרים" נצברים מהתאריך הזה בלבד.</li>
              <li><strong>עמודים שלא באינדקס:</strong> חלק גדול מעמודי העיר/נושא עדיין "נסרק ולא נכלל באינדקס" בגוגל (מגבלת גיל+סמכות דומיין) - לכן פס הביקוש נמוך. קישורים נכנסים הם החסם, לא התוכן.</li>
              <li>נתוני ערוץ קיימים מאז 22/6/26. גיוס מטפלים מוצג בנפרד כי זה קהל אחר.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
