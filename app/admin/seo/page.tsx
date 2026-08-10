"use client";

import { useCallback, useEffect, useState } from "react";
import OptOutToggle from "./OptOutToggle";

// SEO אורגני - פילוח "ביקוש מול חיפוש-שם". השאלה שהעמוד עונה עליה: כמה
// מהתנועה האורגנית היא אנשים שחיפשו *טיפול* (עיר/גישה/נושא - הנכס שה-SEO
// אמור להביא), וכמה חיפשו *מטפל ספציפי בשמו* ופשוט נחתו על הפרופיל אצלנו.
// המספר הכולל של "אורגני" מטעה - הוא נשלט ע"י חיפושי שם.

type WeekRow = { week: string; demand: number; home: number; name: number; recruit: number; other: number };
type KindRow = { kind: string; sessions: number; viewed: number; quiz: number; contacts: number; certain: number };
type PageRow = { page: string; sessions: number; quiz: number; contacts: number };
type NameRow = { name: string; status: string; sessions: number };
type FunnelRow = { grp: string; sessions: number; viewed: number; quiz: number; contacts: number; certain: number };

type SeoData = {
  since: string;
  window_days: number;
  contacts_since: string;
  home_since: string | null;
  weekly: WeekRow[];
  totals: { sessions: number; demand: number; home: number; name: number; recruit: number; info: number; other: number };
  kinds: KindRow[];
  demand_pages: PageRow[];
  name_top: NameRow[];
  name_breadth: { therapists: number; sessions: number };
  funnel: FunnelRow[];
};

const KIND_LABELS: Record<string, string> = {
  home: "עמוד הבית",
  about: "מי אנחנו",
  developers: "בית למפתחים",
  centers_info: "מידע למרכזים",
  hub: "עמודי רכזת (אינדקס נושאים/גישות)",
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
  if (page === "home") return "עמוד הבית";
  if (prefix === "research") return "מאמר: " + val.replace(/^community\//, "").replace(/-/g, " ");
  if (prefix === "hub") return "רכזת: " + val;
  if (page === "para-medical") return "מאגר פארא-רפואי";
  if (page === "region:online") return "עמוד אונליין";
  return map[prefix] ? `${map[prefix]}: ${val.replace(/-/g, " ")}` : page;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
const rate = (part: number, whole: number) => (whole > 0 ? (100 * part / whole).toFixed(1) : "0");

// גרף קווים שבועי - SVG טהור, בלי ספריות. ציר הזמן LTR (ישן משמאל, חדש מימין)
// כמקובל בגרפי זמן גם בעברית - ה-RTL של העמוד היה הופך את כיוון הזמן.
// (הגרסה הקודמת - עמודות מוערמות - גם קרסה ויזואלית: גובה באחוזים מול הורה
// בלי גובה מוגדר מתאפס, וכל העמודות נראו שטוחות.)
type ChartPt = { week: string; demand: number; name: number; home: number; rest: number };

function WeeklyLineChart({ weeks }: { weeks: WeekRow[] }) {
  if (weeks.length === 0) return null;
  const pts: ChartPt[] = weeks.map((w) => ({
    week: w.week, demand: w.demand, name: w.name, home: w.home, rest: w.recruit + w.other,
  }));
  const W = 720, H = 210, padL = 30, padR = 16, padT = 16, padB = 32;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxY = Math.max(5, ...pts.flatMap((p) => [p.demand, p.name, p.home, p.rest]));
  const x = (i: number) => padL + (pts.length === 1 ? innerW / 2 : (i * innerW) / (pts.length - 1));
  const y = (v: number) => padT + innerH * (1 - v / maxY);
  // הנקודה האחרונה היא תמיד שבוע שעדיין רץ, וקו שצולל לשבריר משבוע מלא נקרא
  // כמו קריסה. ב-10/8/26 זה קרה בפועל: יום שני, יום אחד מתוך שבעה, נראה כמו
  // ירידה דרסטית. לכן הקטע האחרון מקווקו, הסמן חלול, והתווית אומרת כמה ימים
  // באמת נספרו.
  const last = pts.length - 1;
  const daysIn = Math.min(7, Math.max(1, Math.ceil((Date.now() - new Date(pts[last].week + "T00:00:00").getTime()) / 86_400_000)));
  const partial = pts.length > 1 && daysIn < 7;
  const solidEnd = partial ? last - 1 : last;
  const seg = (get: (p: ChartPt) => number, from: number, to: number) =>
    pts.slice(from, to + 1).map((p, k) => `${k === 0 ? "M" : "L"}${x(from + k).toFixed(1)},${y(get(p)).toFixed(1)}`).join(" ");
  // השטח נעצר בשבוע המלא האחרון - אחרת הוא מצייר את אותה "מצוק" בעצמו.
  const area = `${seg((p) => p.demand, 0, solidEnd)} L${x(solidEnd).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const partialNote = partial ? ` (חלקי - ${daysIn} מתוך 7 ימים)` : "";
  const fmt = (w: string) => new Date(w + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
  // תווית מתחת לנקודה, אלא אם היא קרובה לתחתית - אז מעליה (שלא תדרוס את ציר התאריכים)
  const labelY = (v: number, below: boolean) => {
    const py = y(v);
    if (below) return py > padT + innerH * 0.82 ? py - 8 : py + 16;
    return py < padT + 12 ? py + 16 : py - 8;
  };
  const series: { get: (p: ChartPt) => number; color: string; width: number; dash?: string }[] = [
    { get: (p) => p.rest, color: "#A8A29E", width: 1.4, dash: "4 3" },
    { get: (p) => p.home, color: "#0284C7", width: 1.8 },
    { get: (p) => p.name, color: "#D49018", width: 2 },
    { get: (p) => p.demand, color: "#3D8C8A", width: 2.6 },
  ];
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="מגמה שבועית של מבקרים אורגניים">
        {[0, Math.round(maxY / 2), maxY].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#E7E5E4" strokeWidth={1} />
            <text x={padL - 6} y={y(g) + 3.5} textAnchor="end" fontSize={10} fill="#A8A29E">{g}</text>
          </g>
        ))}
        <path d={area} fill="#3D8C8A" opacity={0.07} />
        {series.map((s, si) => (
          <g key={si}>
            <path d={seg(s.get, 0, solidEnd)} fill="none" stroke={s.color} strokeWidth={s.width}
              strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
            {partial && (
              <path d={seg(s.get, solidEnd, last)} fill="none" stroke={s.color} strokeWidth={s.width}
                strokeDasharray="3 4" opacity={0.5} strokeLinecap="round" />
            )}
          </g>
        ))}
        {pts.map((p, i) => {
          const open = partial && i === last; // שבוע שעדיין רץ - סמן חלול
          const dot = (cy: number, r: number, color: string) => ({
            cx: x(i), cy, r, fill: open ? "#fff" : color,
            stroke: open ? color : undefined, strokeWidth: open ? 1.6 : undefined,
          });
          return (
            <g key={p.week} opacity={open ? 0.72 : 1}>
              <circle {...dot(y(p.name), 3, "#D49018")}>
                <title>{`שבוע ${fmt(p.week)}: חיפוש שם ${p.name}${open ? partialNote : ""}`}</title>
              </circle>
              <text x={x(i)} y={labelY(p.name, false)} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#A87010">{p.name}</text>
              <circle {...dot(y(p.demand), 3.2, "#3D8C8A")}>
                <title>{`שבוע ${fmt(p.week)}: ביקוש ${p.demand}${open ? partialNote : ""}`}</title>
              </circle>
              <text x={x(i)} y={labelY(p.demand, true)} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#0F5468">{p.demand}</text>
              {p.home > 0 && (
                <circle {...dot(y(p.home), 2.6, "#0284C7")}>
                  <title>{`שבוע ${fmt(p.week)}: עמוד הבית ${p.home}${open ? partialNote : ""}`}</title>
                </circle>
              )}
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="#A8A29E">
                {open ? `${fmt(p.week)} · ${daysIn}/7` : fmt(p.week)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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
  // מכנה האחוזים: מבקרים שהם מטופלים פוטנציאליים בלבד - בלי גיוס, בלי עמודי
  // תדמית (מי אנחנו/מפתחים/מרכזים) ובלי "אחר".
  const patientSessions = t ? t.sessions - t.recruit - (t.info ?? 0) - t.other : 0;
  const demandConv = data?.funnel.find((c) => c.grp === "demand");
  const nameConv = data?.funnel.find((c) => c.grp === "name");

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
        של שם המטפל - 98% מהמבקרים האלה צופים במטפל אחד בלבד. כניסה שנחתה על עמוד עיר/גישה/מאגר/שאלון היא
        <strong> ביקוש אמיתי לטיפול</strong> - הנכס שה-SEO אמור לייצר. הסיווג לפי הנגיעה הראשונה של כל מבקר.
      </p>
      <p className="mb-4 max-w-3xl rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
        <strong>&quot;מבקר&quot; = דפדפן, לא ביקור.</strong> המזהה נשמר בדפדפן ללא תפוגה, ולכן מי שנכנס
        עשרות פעמים נספר <strong>פעם אחת</strong> - בשבוע שבו נכנס לראשונה דרך גוגל. לכן המספרים כאן
        הם &quot;מבקרים אורגניים חדשים&quot;, לא כניסות, והם אינם מנופחים ע&quot;י כניסות חוזרות שלך.
      </p>
      <div className="mb-6"><OptOutToggle /></div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-stone-400 animate-pulse">טוען…</p>}

      {!loading && data && t && (
        <>
          {/* KPI */}
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="text-2xl font-black text-[#0F5468]">{t.demand}</div>
              <div className="text-xs font-bold text-stone-600">ביקוש אמיתי</div>
              <div className="text-[11px] text-stone-400">{pct(t.demand, patientSessions)}% ממבקרי מטופלים · {demandConv ? `${rate(demandConv.quiz, demandConv.sessions)}% מילאו שאלון` : ""}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-2xl font-black text-amber-800">{t.name}</div>
              <div className="text-xs font-bold text-stone-600">חיפוש שם מטפל</div>
              <div className="text-[11px] text-stone-400">{pct(t.name, patientSessions)}% ממבקרי מטופלים · {nameConv ? `${rate(nameConv.contacts, nameConv.sessions)}% לחצו ליצירת קשר` : ""}</div>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
              <div className="text-2xl font-black text-sky-800">{data.home_since ? t.home : "—"}</div>
              <div className="text-xs font-bold text-stone-600">עמוד הבית</div>
              <div className="text-[11px] text-stone-400">
                {data.home_since
                  ? `מותג + חיפוש כללי · נמדד מ-${new Date(data.home_since + "T00:00:00").toLocaleDateString("he-IL")}`
                  : "המדידה החלה היום - נתונים מחר"}
              </div>
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
              <span className="ms-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" /> עמוד הבית</span>
              <span className="ms-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> חיפוש שם</span>
              <span className="ms-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-stone-300" /> גיוס/אחר</span>
            </p>
            <WeeklyLineChart weeks={data.weekly} />
            <p className="mt-3 text-[11px] leading-5 text-stone-400">
              הקו הירקרק (ביקוש) הוא המדד היחיד שאומר אם ה-SEO עובד. הקו הענברי (חיפושי שם) יגדל עם כל מטפל
              שמצטרף - גם בלי שום שיפור בדירוג. הזמן זורם משמאל לימין. הנקודה האחרונה היא שבוע שעדיין
              רץ: היא מצוירת מקווקו וחלול, והתווית שמתחתיה אומרת כמה ימים מתוך שבעה כבר נספרו - אל
              תשוו אותה לשבועות המלאים שלפניה.
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
              {(["demand", "home", "name"] as const).map((grp) => {
                const f = data.funnel.find((x) => x.grp === grp);
                if (!f || f.sessions === 0) return null;
                const color = grp === "demand" ? "#3D8C8A" : grp === "home" ? "#0284C7" : "#D49018";
                const textColor = grp === "demand" ? "#0F5468" : grp === "home" ? "#075985" : "#A87010";
                const steps = [
                  { label: "כניסות", n: f.sessions },
                  { label: "צפו בפרופיל מטפל", n: f.viewed },
                  { label: "השלימו שאלון התאמה", n: f.quiz },
                  { label: "לחצו ליצירת קשר", n: f.contacts },
                ];
                return (
                  <div key={grp}>
                    <div className="mb-1.5 text-sm font-black" style={{ color: textColor }}>
                      {grp === "demand" ? "🌱 ביקוש (עיר / גישה / נושא / מאגר / שאלון)"
                        : grp === "home" ? "🏠 עמוד הבית (מותג + חיפוש כללי)"
                        : "🔎 חיפוש שם מטפל"}
                    </div>
                    <div className="flex flex-wrap items-stretch gap-1.5">
                      {steps.map((s, i) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-stone-300">←</span>}
                          <div className="rounded-xl border px-3 py-2 text-center"
                            style={{ borderColor: color + "55", background: color + "0F", minWidth: "104px" }}>
                            <div className="text-lg font-black" style={{ color: textColor }}>{s.n}</div>
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
                    <th className="pb-2 text-left font-semibold">מבקרים</th>
                    <th className="pb-2 text-left font-semibold" title="השלימו שאלון התאמה">שאלון</th>
                    <th className="pb-2 text-left font-semibold" title="מבקרים עם לחיצת יצירת קשר">קשר</th>
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
              {data.name_breadth.sessions} מבקרים נחתו ישר על פרופיל, על פני {data.name_breadth.therapists} מטפלים שונים.
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
              <li><strong>המרה מאוחרת באותו דפדפן כן נספרת:</strong> המזהה והערוץ נשמרים בדפדפן, ולכן מי שמילא שאלון היום ולחץ ליצירת קשר בביקור אחר בעוד יומיים - נספר כהמרה של אותו מבקר אורגני. מה שאינו נתפס: המשך מ<strong>מכשיר אחר</strong> (שאלון בנייד, פנייה מהמחשב) - שם ההמרה תיזקף למכשיר השני.</li>
              <li><strong>&quot;ערוץ&quot; = ערוץ הגיוס של הדפדפן, לא של הביקור:</strong> דפדפן שהגיע לראשונה ישירות ורק אחר כך דרך גוגל נשאר &quot;ישיר&quot; (רק תיוג קמפיין מפורש דורס את הערוץ). המשמעות: המספרים האורגניים כאן מוטים כלפי מטה - ספירה שמרנית.</li>
              <li><strong>הטיה אפשרית:</strong> מבקר חוזר שנכנס ישירות לפרופיל אחרי שפג הסשן ייספר כחיפוש שם. ההיקף מוגבל (98% מהמבקרים האלה חד-מטפליים).</li>
              <li><strong>מאמרים:</strong> מעקב הכניסות למאמרים נוסף ב-6/8/26 - נתוני "מאמרים" נצברים מהתאריך הזה בלבד.</li>
              <li><strong>גלישה פרטית שוברת את הספירה-פעם-אחת:</strong> חלון אנונימי מקבל מזהה חדש בכל פתיחה, ולכן בדיקות שלך במצב פרטי כן נספרות כמבקרים חדשים. הכפתור &quot;אל תספור אותי&quot; למעלה לא שורד מצב פרטי - שם עדיף פשוט לא להיכנס מגוגל.</li>
              <li><strong>עמוד הבית נמדד רק מ-6/8/26.</strong> עד אז הוא לא שלח שום אירוע - מי שנחת בו מחיפוש מותג (&quot;טיפול חכם&quot;) או כללי (&quot;פסיכולוג&quot;) ואז לחץ בתפריט, נספר כאילו נחת על היעד שלחץ עליו. זו הסיבה ש&quot;מאגר המטפלים&quot; נראה גדול בנתונים ההיסטוריים. הוא גם מופרד מ&quot;ביקוש&quot; במכוון: הוא מערבב חיפושי מותג עם חיפושים כלליים, וההפרדה ביניהם אפשרית רק ב-GSC.</li>
              <li><strong>עמודים שלא באינדקס:</strong> חלק גדול מעמודי העיר/נושא עדיין "נסרק ולא נכלל באינדקס" בגוגל (מגבלת גיל+סמכות דומיין) - לכן פס הביקוש נמוך. קישורים נכנסים הם החסם, לא התוכן.</li>
              <li>נתוני ערוץ קיימים מאז 22/6/26. גיוס מטפלים מוצג בנפרד כי זה קהל אחר.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
