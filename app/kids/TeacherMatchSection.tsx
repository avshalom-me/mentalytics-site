"use client";

import { useEffect, useState } from "react";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import { useTeacherImpressions } from "@/app/learning/TeacherContactButtons";
import TeacherResults, { type TeacherCard } from "@/app/learning/TeacherResults";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { teacherSearchFromKey, TEACHER_LANGUAGES, type TeacherGradeGroup } from "@/app/lib/teacher-options";
import { needLabel, type TeacherNeed } from "@/app/lib/teacher-needs";

// מסך חיפוש המורים בתוך שאלון הילדים - המקבילה של KidsMatchSection לכרטיס
// מסוג "teacher". קורא ל-/api/match-teachers (טבלת המורים בלבד), ומציג
// כרטיסים באותה צורה שההורים כבר מכירים: "באזור שבחרתם" ואחריה הסביבה.
//
// בכוונה אין כאן אף אירוע של analytics_events (matching_click, match_search,
// match_results): הם מזינים את מדדי ההיצע של המטפלים, וחיפוש מורה שחוזר
// ריק היה נספר שם כמחסור במטפלים. הביקוש למורים נרשם בשרת ב-teacher_searches,
// וההופעות והלחיצות ב-teacher_events.
//
// הכרטיסים עצמם ב-TeacherResults, שמשותף גם לחיפוש הישיר בדלת "לימוד חכם".

export default function TeacherMatchSection({
  referralKey,
  gradeGroup,
  quizType,
  needs = [],
}: {
  /** מפתח ההמלצה, למשל "הוראה מתקנת - חשבון". */
  referralKey: string;
  gradeGroup: TeacherGradeGroup | null;
  quizType: "kids" | "school";
  /**
   * הקשיים שהשאלון כבר זיהה (teacher-needs.ts). מורים עם ניסיון מתאים
   * מופיעים ראשונים בתוך האזור. לא סינון, ושום שאלה לא נוספה בשבילם.
   */
  needs?: TeacherNeed[];
}) {
  const search = teacherSearchFromKey(referralKey);
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [online, setOnline] = useState(false);
  const [gender, setGender] = useState("");
  const [language, setLanguage] = useState("עברית");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TeacherCard[]>([]);
  // האזור שהחיפוש האחרון רץ עליו - הכותרות נקבעות לפיו ולא לפי הטופס, שהמשתמש
  // יכול לשנות אחרי שהתוצאות כבר על המסך.
  const [searchedWith, setSearchedWith] = useState<{ located: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setResults([]);
    setSearchedWith(null);
    setError("");
  }, [referralKey]);

  // יועצת שמעיינת בתוצאות אינה הורה שמחפש מורה - ההופעות אצלה לא נספרות למורה,
  // כמו שהן לא נספרות למטפלים בשאלון היועצות.
  const ctx = { source: "match" as const, quizType, subject: search.subject };
  useTeacherImpressions(quizType === "school" ? [] : results.map((t) => t.id), ctx);

  async function doMatch() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/match-teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: referralKey,
          gradeGroup,
          city: city || null,
          region: city ? (CITY_TO_REGION[city] ?? region ?? null) : region || null,
          onlineRequired: online,
          genderPreference: gender || null,
          language,
          needs,
          limit: 10,
          quizType,
          sessionId: getOrCreateSessionId(),
          // מכשיר של הצוות: החיפוש לא נרשם כביקוש.
          noTrack: trackingOptedOut(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "שגיאה בחיפוש");
      setResults(data.matches || []);
      setSearchedWith({ located: !!(city || region) });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בחיפוש");
    } finally {
      setLoading(false);
    }
  }

  const located = !!searchedWith?.located;

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md transition hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#1d5f8a,#2f88b8)" }}
        >
          🎓 מציאת {search.label} - באזורכם
        </button>
      ) : (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="font-bold text-[var(--teal-dark)] text-lg mb-1">מציאת {search.label}</h3>
          <p className="text-xs text-gray-500 mb-4">
            מורים שההכשרה שלהם אומתה, לפי התחום ושכבת הגיל. הפנייה היא ישירות למורה.
            {needs.length > 0 && ` בתוך האזור שתבחרו יוצגו ראשונים מורים שהצהירו על ניסיון עם מה שעלה בשאלון: ${needs.map((n) => needLabel(n, true)).join(", ")}.`}
          </p>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#2a3a5a] cursor-pointer">
              <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="w-4 h-4" />
              פתוחים גם לשיעורים אונליין
            </label>
          </div>
          <div className="mb-4">
            <label htmlFor="tm-region" className="block text-sm font-semibold text-[#2a3a5a] mb-1">אזור מגורים</label>
            <select id="tm-region" value={region} onChange={(e) => { setRegion(e.target.value); setCity(""); }} className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm mb-2">
              <option value="">-- בחר אזור --</option>
              {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {region && (
              <>
                <label htmlFor="tm-city" className="block text-sm font-semibold text-[#2a3a5a] mb-1">עיר</label>
                <select id="tm-city" value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm">
                  <option value="">-- כל האזור --</option>
                  {(REGION_CITIES[region] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            {!region && !online && (
              <p className="mt-2 rounded-xl bg-[var(--teal-pale)] px-3 py-2 text-xs leading-relaxed text-[#3E5250]">
                בלי אזור וללא סימון אונליין יוצגו מורים מכל הארץ, בלי התחשבות במרחק.
              </p>
            )}
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tm-language" className="block text-sm font-semibold text-[#2a3a5a] mb-1">שפת ההוראה</label>
              <select id="tm-language" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm">
                {TEACHER_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <div id="tm-gender" className="text-sm font-semibold text-[#2a3a5a] mb-2">העדפת מגדר</div>
              <div role="radiogroup" aria-labelledby="tm-gender" className="flex gap-4">
                {(["", "זכר", "נקבה"] as const).map((g) => (
                  <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="tm-gender" checked={gender === g} onChange={() => setGender(g)} />
                    {g || "ללא העדפה"}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="button" onClick={doMatch} disabled={loading} className="w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#1d5f8a,#2f88b8)" }}>
            {loading ? "מחפש..." : "חיפוש מורה"}
          </button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {searchedWith && (
        <div className="mt-5">
          <TeacherResults
            results={results}
            located={located}
            ctx={ctx}
            profileQuery={`from=match${quizType === "school" ? "&q=school" : ""}`}
            empty={
              <div className="rounded-2xl bg-sky-50 px-5 py-6 text-center text-sm leading-6 text-[#2a3a5a]">
                <p className="font-bold">לא נמצאו מורים מתאימים לפי הפרמטרים שנבחרו.</p>
                <p className="mt-1 text-xs text-gray-500">המאגר של לימוד חכם חדש ועדיין נבנה. אפשר לנסות בלי עיר, או לסמן אונליין. ההמלצה עצמה תקפה גם דרך בית הספר.</p>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
