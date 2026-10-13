"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import TeacherResults from "@/app/learning/TeacherResults";
import { sendTeacherEvent } from "@/app/learning/TeacherContactButtons";
import { rankTeachers } from "@/app/lib/teacher-match";
import { teacherCard, type DirectoryTeacher } from "@/app/lib/teacher-card";
import {
  TEACHER_SUBJECTS,
  TEACHER_SUBJECT_KEYS,
  TEACHER_GRADE_GROUPS,
  TEACHER_GRADE_KEYS,
  type TeacherGradeGroup,
  type TeacherSubject,
} from "@/app/lib/teacher-options";
import { TEACHER_NEEDS, sanitizeNeeds, type TeacherNeed } from "@/app/lib/teacher-needs";
import { parseTeacherQuery, describeParsedQuery } from "@/app/lib/teacher-query-parse";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { SAMPLE_TEACHERS } from "./sample-teachers";

// מאגר המורים של "לימוד חכם": כל המורים המוצגים, עם סינון לפי תחום, סוג
// המורה, כיתה, אזור, עיר ואונליין - כמו מאגר המטפלים (הבעלים, 13/10/2026).
//
// הסינון והסדר נעשים כאן, בדפדפן, עם אותו מנוע של החיפוש מתוך השאלון
// (rankTeachers): קודם האזור, בתוכו מי שיש לו ניסיון עם הקשיים שצוינו, ואף
// מורה לא נושר בגלל הקשיים. השרת מוסר את השורות הציבוריות בלבד.
//
// שלושה דברים נשמרים מהחיפוש הישיר שהיה כאן לפני כן (TeacherDirectSearch):
//   • שדה הכתיבה החופשית של הבעלים. מפוענח בדפדפן בלבד, ורק ממלא את המסננים.
//   • שורת ביקוש ב-teacher_searches: סינון הוא "מה הורה חיפש", וזה הנתון
//     שמגייסים לפיו. נשלח אחרי שהבחירות נרגעות, ולא על הרשימה המלאה.
//   • הופעות ב-teacher_events (source = direct), רק לכרטיסים שבאמת הוצגו.

const PAGE_SIZE = 20;
/** כמה זמן אחרי השינוי האחרון במסננים נרשמת שורת הביקוש. */
const DEMAND_LOG_DELAY_MS = 2500;

const selectCls = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--teal)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-bold text-[var(--muted)]";
const toggleBase = "rounded-full border-[1.5px] px-4 py-2 text-sm font-bold transition-colors";
const toggleOff = "border-[var(--line)] bg-white text-[var(--text-2)] hover:border-[var(--teal)]";
const toggleOn = "border-[var(--teal)] bg-[var(--teal)] text-white";
// תוויות הקשיים ארוכות ונשברות לשתי שורות בטלפון; גלולה מלאה על שתי שורות נראית כמו ביצה.
const needBase = "rounded-[20px] border-[1.5px] px-4 py-2 text-start text-sm font-bold transition-colors";
const needOn = "border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--gold-dark)]";

type Filters = {
  subject: TeacherSubject | "";
  remedialOnly: boolean;
  gradeGroup: TeacherGradeGroup | "";
  region: string;
  city: string;
  onlineOnly: boolean;
  needs: TeacherNeed[];
};

const NO_FILTERS: Filters = { subject: "", remedialOnly: false, gradeGroup: "", region: "", city: "", onlineOnly: false, needs: [] };

function filtersFromUrl(search: string): Filters {
  const p = new URLSearchParams(search);
  const subject = p.get("subject") ?? "";
  const grade = p.get("grade") ?? "";
  const city = p.get("city") ?? "";
  const region = p.get("region") ?? "";
  return {
    subject: (TEACHER_SUBJECT_KEYS as string[]).includes(subject) ? (subject as TeacherSubject) : "",
    remedialOnly: p.get("remedial") === "1",
    gradeGroup: (TEACHER_GRADE_KEYS as string[]).includes(grade) ? (grade as TeacherGradeGroup) : "",
    region: city && CITY_TO_REGION[city] ? CITY_TO_REGION[city] : ALL_REGIONS.includes(region) ? region : "",
    city: CITY_TO_REGION[city] ? city : "",
    onlineOnly: p.get("online") === "1",
    needs: sanitizeNeeds((p.get("needs") ?? "").split(",")),
  };
}

function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.subject) p.set("subject", f.subject);
  if (f.remedialOnly) p.set("remedial", "1");
  if (f.gradeGroup) p.set("grade", f.gradeGroup);
  if (f.city) p.set("city", f.city);
  else if (f.region) p.set("region", f.region);
  if (f.onlineOnly) p.set("online", "1");
  if (f.needs.length) p.set("needs", f.needs.join(","));
  return p.toString();
}

const isFiltered = (f: Filters) => !!(f.subject || f.remedialOnly || f.gradeGroup || f.region || f.city || f.onlineOnly || f.needs.length);

export default function TeachersDirectory({ teachers, serverDay }: { teachers: DirectoryTeacher[]; serverDay: string }) {
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  // null = עוד לא נלחץ; [] = נלחץ ולא זוהה דבר.
  const [understood, setUnderstood] = useState<string[] | null>(null);
  const usedText = useRef(false);
  // ?preview=1 על מאגר ריק מציג מורים לדוגמה, כדי שאפשר יהיה לראות את המאגר
  // לפני שהצטרפו מורים. נקרא אחרי הטעינה, כך שהעמוד עצמו נשאר סטטי.
  const [preview, setPreview] = useState(false);

  // הסינון נקרא מהכתובת אחרי הטעינה (קישורים מהדלת מגיעים עם ?subject=...),
  // ונכתב אליה בכל שינוי, כדי ש"אחורה" מפרופיל יחזיר את אותה רשימה.
  // ready הוא state ולא ref: כך הכתיבה לכתובת רצה רק ברינדור שבו הסינון מהכתובת
  // כבר נכנס, ולא מוחקת אותו ברינדור הראשון.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const fromUrl = filtersFromUrl(window.location.search);
    setF(fromUrl);
    if (fromUrl.needs.length) setMore(true);
    setPreview(new URLSearchParams(window.location.search).get("preview") === "1");
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams(window.location.search);
    const keep = p.get("preview") === "1" ? "preview=1" : "";
    const qs = [filtersToQuery(f), keep].filter(Boolean).join("&");
    const url = window.location.pathname + (qs ? `?${qs}` : "");
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state ?? {}, "", url);
  }, [f, ready]);

  const sample = preview && teachers.length === 0;
  const pool = sample ? SAMPLE_TEACHERS : teachers;

  const set = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setShown(PAGE_SIZE);
  };

  const located = !!(f.city || f.region);
  const results = useMemo(() => {
    // "אונליין בלבד" הוא סינון של ממש; במנוע אונליין הוא רק דרך להגיע למורה רחוק.
    const rows = f.onlineOnly ? pool.filter((t) => t.online) : pool;
    const byId = new Map(pool.map((t) => [t.id, t.photo_url]));
    return rankTeachers(
      rows,
      {
        subject: f.subject || null,
        remedial: f.remedialOnly,
        gradeGroup: f.gradeGroup || null,
        city: f.city || null,
        region: f.city ? (CITY_TO_REGION[f.city] ?? null) : f.region || null,
        onlineRequired: f.onlineOnly,
        language: "",
        genderPreference: null,
        needs: f.needs,
      },
      // היום של השרת קובע את הסבב היומי, כדי שה-HTML מהשרת והרינדור בדפדפן יסכימו.
      new Date(`${serverDay}T12:00:00Z`),
    ).map((m) => teacherCard(m, byId.get(m.teacher.id) ?? null));
  }, [pool, f, serverDay]);
  const visible = results.slice(0, shown);

  // הופעות: רק מה שעל המסך, וכל מורה פעם אחת לכל כניסה לעמוד.
  const ctx = useMemo(() => ({ source: "direct" as const, quizType: null, subject: f.subject || null }), [f.subject]);
  const seen = useRef(new Set<string>());
  const visibleKey = visible.map((t) => t.id).join(",");
  useEffect(() => {
    if (sample) return;
    const fresh = visible.map((t) => t.id).filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    for (let i = 0; i < fresh.length; i += 20) sendTeacherEvent("impression", fresh.slice(i, i + 20), ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, sample]);

  // ביקוש: מה הורים מסננים, וכמה מורים מצאו. לא נרשם בלי סינון (זו כניסה
  // לעמוד, לא חיפוש), לא במכשיר של הצוות, ולא פעמיים על אותן בחירות.
  const lastLogged = useRef("");
  useEffect(() => {
    if (!ready || sample || !isFiltered(f)) return;
    const key = filtersToQuery(f);
    if (key === lastLogged.current) return;
    const timer = setTimeout(() => {
      lastLogged.current = key;
      fetch("/api/match-teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          direct: true,
          subject: f.subject || null,
          remedial: f.remedialOnly,
          gradeGroup: f.gradeGroup || null,
          city: f.city || null,
          region: f.city ? (CITY_TO_REGION[f.city] ?? null) : f.region || null,
          onlineRequired: f.onlineOnly,
          needs: f.needs,
          // רק העובדה שנעשה שימוש בשדה החופשי. הטקסט עצמו נשאר כאן.
          usedText: usedText.current,
          limit: 20,
          sessionId: getOrCreateSessionId(),
          noTrack: trackingOptedOut(),
        }),
      }).catch(() => {});
    }, DEMAND_LOG_DELAY_MS);
    return () => clearTimeout(timer);
  }, [f, sample, ready]);

  function applyText() {
    const parsed = parseTeacherQuery(text);
    const found = describeParsedQuery(parsed);
    setUnderstood(found);
    if (found.length === 0) return;
    usedText.current = true;
    const patch: Partial<Filters> = {};
    if (parsed.subject) patch.subject = parsed.subject;
    if (parsed.remedial !== null) patch.remedialOnly = parsed.remedial;
    if (parsed.gradeGroup) patch.gradeGroup = parsed.gradeGroup;
    if (parsed.city) {
      patch.region = CITY_TO_REGION[parsed.city] ?? "";
      patch.city = parsed.city;
    } else if (parsed.region) {
      patch.region = parsed.region;
      patch.city = "";
    }
    if (parsed.online) patch.onlineOnly = true;
    if (parsed.needs.length > 0) patch.needs = TEACHER_NEEDS.map((n) => n.key).filter((k) => f.needs.includes(k) || parsed.needs.includes(k));
    set(patch);
  }

  const toggleNeed = (key: TeacherNeed) =>
    set({ needs: f.needs.includes(key) ? f.needs.filter((k) => k !== key) : TEACHER_NEEDS.map((n) => n.key).filter((k) => k === key || f.needs.includes(k)) });

  // המאגר ריק: בלי מסננים. מסננים מעל רשימה ריקה מובילים כל הורה ל"לא נמצא".
  if (pool.length === 0) {
    return (
      <div className="rounded-[20px] border border-[var(--line)] bg-white p-6 text-center sm:p-9">
        <h2 className="text-xl font-black text-[var(--text)]">המאגר נפתח בימים אלה</h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[var(--text-2)]">
          עדיין אין במאגר מורים להציג. כשיצטרפו, הם יופיעו כאן עם סינון לפי תחום, כיתה ואזור. בינתיים, השאלון לילדים ולנוער מציע
          כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/kids" className="inline-flex items-center justify-center rounded-full bg-[var(--teal)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--teal-dark)]">
            לשאלון לילדים ולנוער
          </Link>
          <Link href="/learning/join" className="inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--teal)] bg-white px-7 py-3 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
            מורים: הצטרפות למאגר
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {sample && (
        <p role="note" className="mb-5 rounded-2xl border border-[var(--gold)] bg-[var(--gold-pale)] px-4 py-3 text-sm font-bold leading-6 text-[var(--gold-dark)]">
          תצוגה לדוגמה. המורים שמופיעים כאן אינם אמיתיים, והם מוצגים רק כדי להראות איך המאגר ייראה.
        </p>
      )}

      {/* המסננים. מחוץ לקטע שגוגל מצטט, כמו במאגר המטפלים: רשימת הערים ארוכה,
          וחיפוש ששמו עיר היה מתאים לה יותר מאשר לפסקת הפתיחה של העמוד. */}
      <div data-nosnippet className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="td-subject" className={labelCls}>תחום</label>
            <select id="td-subject" value={f.subject} onChange={(e) => set({ subject: e.target.value as Filters["subject"] })} className={selectCls}>
              <option value="">כל התחומים</option>
              {TEACHER_SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="td-grade" className={labelCls}>כיתה</label>
            <select id="td-grade" value={f.gradeGroup} onChange={(e) => set({ gradeGroup: e.target.value as Filters["gradeGroup"] })} className={selectCls}>
              <option value="">כל הכיתות</option>
              {TEACHER_GRADE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="td-region" className={labelCls}>אזור</label>
            <select id="td-region" value={f.region} onChange={(e) => set({ region: e.target.value, city: "" })} className={selectCls}>
              <option value="">כל הארץ</option>
              {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="td-city" className={labelCls}>עיר</label>
            <select id="td-city" value={f.city} onChange={(e) => set({ city: e.target.value })} disabled={!f.region} className={`${selectCls} disabled:bg-[var(--surface-2)] disabled:text-[var(--faint)]`}>
              <option value="">{f.region ? "כל האזור" : "בוחרים קודם אזור"}</option>
              {(REGION_CITIES[f.region] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={f.remedialOnly} onClick={() => set({ remedialOnly: !f.remedialOnly })} className={`${toggleBase} ${f.remedialOnly ? toggleOn : toggleOff}`}>
            רק הוראה מתקנת וחינוך מיוחד
          </button>
          <button type="button" aria-pressed={f.onlineOnly} onClick={() => set({ onlineOnly: !f.onlineOnly })} className={`${toggleBase} ${f.onlineOnly ? toggleOn : toggleOff}`}>
            אונליין בלבד
          </button>
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="px-2 py-2 text-sm font-bold text-[var(--teal-dark)] underline underline-offset-4">
            {more ? "פחות אפשרויות" : "קשב, דיסלקסיה או קושי אחר"}
          </button>
          {isFiltered(f) && (
            <button type="button" onClick={() => { setF(NO_FILTERS); setShown(PAGE_SIZE); setUnderstood(null); }} className="px-2 py-2 text-sm text-[var(--muted)] underline underline-offset-4">
              ניקוי הסינון
            </button>
          )}
        </div>

        {more && (
          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <div id="td-needs" className="mb-2 block text-sm font-extrabold text-[var(--text)]">
              יש ברקע אחד מאלה? <span className="font-normal text-[var(--muted)]">(לא חובה)</span>
            </div>
            <div role="group" aria-labelledby="td-needs" className="flex flex-wrap gap-2">
              {TEACHER_NEEDS.map((n) => (
                <button key={n.key} type="button" aria-pressed={f.needs.includes(n.key)} onClick={() => toggleNeed(n.key)} className={`${needBase} ${f.needs.includes(n.key) ? needOn : toggleOff}`}>
                  {f.needs.includes(n.key) ? "✓ " : ""}{n.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              מורים שכתבו שיש להם ניסיון מתאים יוצגו ראשונים בתוך האזור שבחרתם. אף מורה לא מוסתר בגלל הבחירה הזו.
            </p>

            <label htmlFor="td-text" className="mb-2 mt-5 block text-sm font-extrabold text-[var(--text)]">
              אפשר גם לתאר במילים שלכם <span className="font-normal text-[var(--muted)]">(לא חובה)</span>
            </label>
            <textarea
              id="td-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="למשל: מורה להוראה מתקנת בקריאה לבת בכיתה ג׳ ברעננה, יש רקע של קושי שפתי"
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--faint)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={applyText} disabled={!text.trim()} className="rounded-full border-[1.5px] border-[var(--teal)] bg-white px-5 py-2 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)] disabled:cursor-not-allowed disabled:opacity-50">
                מילוי המסננים לפי מה שכתבתי
              </button>
              <span className="text-xs leading-5 text-[var(--muted)]">הטקסט מעובד בדפדפן שלכם, לא נשלח אלינו ולא נשמר. אין צורך לכתוב את שם הילד.</span>
            </div>
            <div aria-live="polite">
              {understood && understood.length > 0 && (
                <div className="mt-3 rounded-xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] px-4 py-3">
                  <p className="text-sm font-bold text-[var(--teal-dark)]">מה הבנו מהטקסט:</p>
                  <ul className="mt-2 flex list-none flex-wrap gap-2">
                    {understood.map((label) => (
                      <li key={label} className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[var(--teal-dark)]">{label}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">המסננים מולאו בהתאם, ואפשר לשנות כל אחד מהם.</p>
                </div>
              )}
              {understood && understood.length === 0 && (
                <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-[var(--text-2)]">לא הצלחנו לזהות בחירות מהטקסט. אפשר לבחור ישירות במסננים.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-7" aria-live="polite">
        <TeacherResults
          results={visible}
          total={results.length}
          located={located}
          ctx={ctx}
          profileQuery="from=direct"
          showScore={false}
          empty={
            <div className="rounded-2xl border border-[var(--line)] bg-white px-5 py-7 text-center">
              <p className="font-bold text-[var(--text)]">עדיין אין במאגר מורים שמתאימים לסינון הזה.</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-2)]">
                המאגר חדש ומתמלא בהדרגה. אפשר להרחיב את האזור, להסיר אחד מהמסננים, או למלא את{" "}
                <Link href="/kids" className="font-bold text-[var(--teal-dark)] underline underline-offset-4">השאלון לילדים ולנוער</Link>{" "}
                כדי לקבל כיוון.
              </p>
            </div>
          }
        />
        {results.length > shown && (
          <div className="mt-6 text-center">
            <button type="button" onClick={() => setShown(shown + PAGE_SIZE)} className="rounded-full border-[1.5px] border-[var(--teal)] bg-white px-7 py-3 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
              הצגת מורים נוספים ({results.length - shown})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
