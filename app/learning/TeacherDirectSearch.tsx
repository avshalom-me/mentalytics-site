"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import { useTeacherImpressions } from "@/app/learning/TeacherContactButtons";
import TeacherResults, { type TeacherCard } from "@/app/learning/TeacherResults";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackingOptedOut } from "@/app/lib/track-optout";
import {
  TEACHER_SUBJECTS,
  TEACHER_GRADE_GROUPS,
  TEACHER_LANGUAGES,
  type TeacherGradeGroup,
  type TeacherSubject,
} from "@/app/lib/teacher-options";
import { TEACHER_NEEDS, type TeacherNeed } from "@/app/lib/teacher-needs";
import { parseTeacherQuery, describeParsedQuery } from "@/app/lib/teacher-query-parse";

// החיפוש הישיר של "לימוד חכם": הורה שהגיע לעמוד בלי השאלון.
//
// שני חלקים, בסדר הזה:
//   1. שדה כתיבה חופשית (לא חובה) - הרעיון של הבעלים. הטקסט מפוענח כאן,
//      בדפדפן, ורק ממלא את הבחירות שמתחתיו. הוא לא נשלח ולא נשמר.
//   2. הבחירות הקצרות - הן מה שנשלח לחיפוש, וההורה רואה ומתקן אותן.
//
// כמו בשאלון, אין כאן אירועים של analytics_events: הביקוש נרשם בשרת ב-
// teacher_searches (quiz_type = direct), וההופעות והלחיצות ב-teacher_events.

type Supply = { total: number; subjects: TeacherSubject[] };

const chipBase = "rounded-full border-[1.5px] px-4 py-2 text-sm font-bold transition-colors";
// התוויות של הקשיים ארוכות ונשברות לשתי שורות בטלפון; גלולה מלאה על שתי שורות נראית כמו ביצה.
const needChipBase = "rounded-[20px] border-[1.5px] px-4 py-2 text-start text-sm font-bold transition-colors";
const chipOff = "border-[var(--line)] bg-white text-[var(--text-2)] hover:border-[var(--teal)]";
const chipOn = "border-[var(--teal)] bg-[var(--teal)] text-white";
const chipNeedOn = "border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--gold-dark)]";
const chipDisabled = "cursor-not-allowed border-[var(--line)] bg-[var(--surface)] text-[var(--faint)]";
const fieldLabel = "mb-2 block text-sm font-extrabold text-[var(--text)]";
const selectCls = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--text)]";

export default function TeacherDirectSearch({ supply }: { supply: Supply }) {
  const [text, setText] = useState("");
  // null = עוד לא נלחץ; [] = נלחץ ולא זוהה דבר.
  const [understood, setUnderstood] = useState<string[] | null>(null);
  const [usedText, setUsedText] = useState(false);

  const [subject, setSubject] = useState<TeacherSubject | "">("");
  const [remedialOnly, setRemedialOnly] = useState(false);
  const [gradeGroup, setGradeGroup] = useState<TeacherGradeGroup | "">("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [online, setOnline] = useState(false);
  const [needs, setNeeds] = useState<TeacherNeed[]>([]);
  const [language, setLanguage] = useState("עברית");
  const [gender, setGender] = useState("");
  const [more, setMore] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TeacherCard[]>([]);
  // מה שהחיפוש האחרון רץ עליו: הכותרות נקבעות לפיו ולא לפי הטופס, שאפשר
  // לשנות אחרי שהתוצאות כבר על המסך.
  const [searched, setSearched] = useState<{ located: boolean; label: string; subject: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ?preview=1 מציג את הטופס גם כשהמאגר ריק - כדי שאפשר יהיה לראות אותו
  // לפני שגויסו מורים. נקרא אחרי הטעינה, כדי שהעמוד עצמו יישאר סטטי.
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).get("preview") === "1");
  }, []);

  // תחום בלי אף מורה מוצג אפור ולא נבחר, כדי שלא יוביל לחיפוש ריק.
  const hasTeachers = (key: TeacherSubject) => preview || supply.subjects.includes(key);

  const ctx = { source: "direct" as const, quizType: null, subject: searched?.subject || null };
  useTeacherImpressions(results.map((t) => t.id), ctx);

  useEffect(() => {
    if (searched) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searched]);

  function applyText() {
    const parsed = parseTeacherQuery(text);
    const found = describeParsedQuery(parsed);
    setUnderstood(found);
    if (found.length === 0) return;
    setUsedText(true);
    // תחום שזוהה אבל אין בו מורים נשאר לא מסומן: הכפתור שלו אפור, וסימון
    // שאי אפשר לראות או לבטל היה שולח את ההורה לחיפוש ריק.
    if (parsed.subject && hasTeachers(parsed.subject)) setSubject(parsed.subject);
    if (parsed.remedial !== null) setRemedialOnly(parsed.remedial);
    if (parsed.gradeGroup) setGradeGroup(parsed.gradeGroup);
    if (parsed.city) {
      setRegion(CITY_TO_REGION[parsed.city] ?? "");
      setCity(parsed.city);
    } else if (parsed.region) {
      setRegion(parsed.region);
      setCity("");
    }
    if (parsed.online) setOnline(true);
    if (parsed.needs.length > 0) setNeeds((prev) => TEACHER_NEEDS.map((n) => n.key).filter((k) => prev.includes(k) || parsed.needs.includes(k)));
    if (parsed.language) {
      setLanguage(parsed.language);
      setMore(true);
    }
  }

  function toggleNeed(key: TeacherNeed) {
    setNeeds((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : TEACHER_NEEDS.map((n) => n.key).filter((k) => k === key || prev.includes(k))));
  }

  async function doSearch() {
    if (!subject || !gradeGroup) {
      setError("כדי לחפש צריך לבחור תחום ושכבת גיל.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/match-teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direct: true,
          subject,
          remedial: remedialOnly,
          gradeGroup,
          city: city || null,
          region: city ? (CITY_TO_REGION[city] ?? region ?? null) : region || null,
          onlineRequired: online,
          genderPreference: gender || null,
          language,
          needs,
          // רק העובדה שנעשה שימוש בשדה החופשי. הטקסט עצמו נשאר כאן.
          usedText,
          limit: 10,
          sessionId: getOrCreateSessionId(),
          // מכשיר של הצוות: החיפוש לא נרשם כביקוש.
          noTrack: trackingOptedOut(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "שגיאה בחיפוש");
      setResults(data.matches || []);
      setSearched({ located: !!(city || region), label: data.search?.label ?? "", subject });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בחיפוש");
    } finally {
      setLoading(false);
    }
  }

  // המאגר ריק: בלי טופס. טופס חיפוש מעל מאגר ריק מוביל כל הורה ל"לא נמצא".
  if (supply.total === 0 && !preview) {
    return (
      <div className="rounded-[20px] border border-[var(--line)] bg-white p-6 text-center sm:p-9">
        <h3 className="text-xl font-black text-[var(--text)]">המאגר נפתח בימים אלה</h3>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[var(--text-2)]">
          מורים מצטרפים עכשיו, וכל אחד מהם מוצג רק אחרי שההכשרה שלו נבדקה מול תעודה. כשיהיו מורים להציג, החיפוש ייפתח כאן.
          בינתיים, השאלון לילדים ולנוער מראה איזה מענה מתאים לילד: הוראה מתקנת, תגבור, אבחון או טיפול.
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

  const someSubjectsEmpty = TEACHER_SUBJECTS.some((s) => !hasTeachers(s.key));

  return (
    <div>
      <p className="mb-6 leading-relaxed text-[var(--text-2)]">
        בחרו תחום, כיתה ואזור, וציינו אם יש ברקע קושי מסוים. אפשר גם לכתוב במילים שלכם, והבחירות יתמלאו בהתאם.
      </p>
      <div className="rounded-[20px] border border-[var(--line)] bg-white p-5 shadow-sm sm:p-8">
        {/* 1. במילים שלכם */}
        <div className="rounded-2xl bg-[var(--surface)] p-4 sm:p-5">
          <label htmlFor="ds-text" className={fieldLabel}>
            אפשר להתחיל בכמה מילים משלכם <span className="font-normal text-[var(--muted)]">(לא חובה)</span>
          </label>
          <p className="mb-3 text-sm leading-relaxed text-[var(--text-2)]">
            כתבו בחופשיות איזה מורה אתם מחפשים, באיזו עיר או אזור, ואם יש ברקע לקות למידה, קושי שפתי או קשיים נוספים.
          </p>
          <textarea
            id="ds-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="למשל: מורה להוראה מתקנת בקריאה לבת בכיתה ג׳ ברעננה, יש רקע של קושי שפתי"
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--faint)]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyText}
              disabled={!text.trim()}
              className="rounded-full border-[1.5px] border-[var(--teal)] bg-white px-5 py-2 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              מלאו את הבחירות לפי מה שכתבתי
            </button>
            <span className="text-xs leading-5 text-[var(--muted)]">הטקסט נשאר בדפדפן שלכם: הוא לא נשלח ולא נשמר.</span>
          </div>
          <div aria-live="polite">
            {understood && understood.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] px-4 py-3">
                <p className="text-sm font-bold text-[var(--teal-dark)]">מה הבנו מהטקסט:</p>
                <ul className="mt-2 flex list-none flex-wrap gap-2">
                  {understood.map((label) => (
                    <li key={label} className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[var(--teal-dark)]">{label}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">הבחירות למטה מולאו בהתאם. אפשר לשנות כל אחת מהן לפני החיפוש.</p>
              </div>
            )}
            {understood && understood.length === 0 && (
              <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-[var(--text-2)]">
                לא הצלחנו לזהות בחירות מהטקסט. אפשר לבחור ישירות למטה.
              </p>
            )}
          </div>
        </div>

        {/* 2. הבחירות - מה שנשלח לחיפוש */}
        <div className="mt-7">
          <div id="ds-subject" className={fieldLabel}>באיזה תחום?</div>
          <div role="radiogroup" aria-labelledby="ds-subject" className="flex flex-wrap gap-2">
            {TEACHER_SUBJECTS.map((s) => {
              const available = hasTeachers(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={subject === s.key}
                  disabled={!available}
                  onClick={() => setSubject(s.key)}
                  className={`${chipBase} ${!available ? chipDisabled : subject === s.key ? chipOn : chipOff}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {someSubjectsEmpty && <p className="mt-2 text-xs text-[var(--muted)]">בתחומים האפורים עדיין אין מורים במאגר.</p>}
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm leading-6 text-[var(--text-2)]">
            <input type="checkbox" checked={remedialOnly} onChange={(e) => setRemedialOnly(e.target.checked)} className="mt-1 h-4 w-4 flex-shrink-0" />
            <span>
              <strong className="text-[var(--text)]">רק מורים להוראה מתקנת</strong> - בעלי תעודה בהוראה מתקנת, תואר בחינוך מיוחד או תואר שני בלקויות למידה.
              בלי הסימון יוצגו גם מורים פרטיים.
            </span>
          </label>
        </div>

        <div className="mt-7">
          <div id="ds-grade" className={fieldLabel}>באיזו כיתה?</div>
          <div role="radiogroup" aria-labelledby="ds-grade" className="flex flex-wrap gap-2">
            {TEACHER_GRADE_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                role="radio"
                aria-checked={gradeGroup === g.key}
                onClick={() => setGradeGroup(g.key)}
                className={`${chipBase} ${gradeGroup === g.key ? chipOn : chipOff}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className={fieldLabel}>איפה?</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ds-region" className="mb-1 block text-xs font-bold text-[var(--muted)]">אזור</label>
              <select id="ds-region" value={region} onChange={(e) => { setRegion(e.target.value); setCity(""); }} className={selectCls}>
                <option value="">כל הארץ</option>
                {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ds-city" className="mb-1 block text-xs font-bold text-[var(--muted)]">עיר</label>
              <select id="ds-city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!region} className={`${selectCls} disabled:bg-[var(--surface)] disabled:text-[var(--faint)]`}>
                <option value="">{region ? "כל האזור" : "בוחרים קודם אזור"}</option>
                {(REGION_CITIES[region] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-2)]">
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="h-4 w-4" />
            פתוחים גם לשיעורים אונליין
          </label>
        </div>

        <div className="mt-7">
          <div id="ds-needs" className={fieldLabel}>
            יש ברקע אחד מאלה? <span className="font-normal text-[var(--muted)]">(לא חובה)</span>
          </div>
          <div role="group" aria-labelledby="ds-needs" className="flex flex-wrap gap-2">
            {TEACHER_NEEDS.map((n) => (
              <button
                key={n.key}
                type="button"
                aria-pressed={needs.includes(n.key)}
                onClick={() => toggleNeed(n.key)}
                className={`${needChipBase} ${needs.includes(n.key) ? chipNeedOn : chipOff}`}
              >
                {needs.includes(n.key) ? "✓ " : ""}{n.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            מורים שהצהירו על ניסיון מתאים יוצגו ראשונים בתוך האזור שבחרתם. אף מורה לא מוסתר בגלל הבחירה הזו.
          </p>
        </div>

        <div className="mt-6">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="text-sm font-bold text-[var(--teal-dark)] underline underline-offset-4">
            {more ? "פחות אפשרויות" : "עוד אפשרויות: שפת ההוראה, העדפת מגדר"}
          </button>
          {more && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ds-language" className="mb-1 block text-xs font-bold text-[var(--muted)]">שפת ההוראה</label>
                <select id="ds-language" value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
                  {TEACHER_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <div id="ds-gender" className="mb-1 block text-xs font-bold text-[var(--muted)]">העדפת מגדר</div>
                <div role="radiogroup" aria-labelledby="ds-gender" className="flex flex-wrap gap-4 pt-2">
                  {(["", "זכר", "נקבה"] as const).map((g) => (
                    <label key={g} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--text-2)]">
                      <input type="radio" name="ds-gender" checked={gender === g} onChange={() => setGender(g)} />
                      {g === "" ? "ללא העדפה" : g === "זכר" ? "גבר" : "אישה"}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={doSearch}
            disabled={loading}
            className="w-full rounded-full bg-[var(--teal)] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[var(--teal-dark)] disabled:opacity-60 sm:w-auto"
          >
            {loading ? "מחפש..." : "חיפוש מורה"}
          </button>
          {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-28">
        {searched && (
          <div className="mt-8">
            {searched.label && <h3 className="mb-4 text-xl font-black text-[var(--text)]">{searched.label}</h3>}
            <TeacherResults
              results={results}
              located={searched.located}
              ctx={ctx}
              profileQuery="from=direct"
              empty={
                <div className="rounded-2xl border border-[var(--line)] bg-white px-5 py-7 text-center">
                  <p className="font-bold text-[var(--text)]">לא נמצאו מורים שמתאימים לחיפוש הזה.</p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-2)]">
                    המאגר חדש ומתמלא בהדרגה. אפשר לנסות בלי עיר, לסמן גם שיעורים אונליין, או להסיר את הסימון של הוראה מתקנת בלבד.
                  </p>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
