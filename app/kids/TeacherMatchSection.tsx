"use client";

import { useEffect, useState } from "react";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import MatchResultCard from "@/app/components/MatchResultCard";
import TeacherContactButtons, { useTeacherImpressions } from "@/app/learning/TeacherContactButtons";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { teacherPath, teacherSearchFromKey, TEACHER_LANGUAGES, type TeacherGradeGroup } from "@/app/lib/teacher-options";

// מסך חיפוש המורים בתוך שאלון הילדים - המקבילה של KidsMatchSection לכרטיס
// מסוג "teacher". קורא ל-/api/match-teachers (טבלת המורים בלבד), ומציג
// כרטיסים באותה צורה שההורים כבר מכירים: "באזור שבחרתם" ואחריה הסביבה.
//
// בכוונה אין כאן אף אירוע של analytics_events (matching_click, match_search,
// match_results): הם מזינים את מדדי ההיצע של המטפלים, וחיפוש מורה שחוזר
// ריק היה נספר שם כמחסור במטפלים. הביקוש למורים נרשם בשרת ב-teacher_searches,
// וההופעות והלחיצות ב-teacher_events.
//
// אין כאן ציון אישיותי ואין "למה הותאם לי": ההתאמה היא תחום, סוג מורה, שכבת
// גיל ומרחק, וזה נאמר בכרטיס במילים.

type TeacherCard = {
  id: string;
  full_name: string;
  gender: string | null;
  slug: string | null;
  photo_url: string | null;
  bio: string | null;
  phone: string | null;
  regions: string[];
  online: boolean;
  remedial: boolean;
  subject_labels: string[];
  grade_labels: string[];
  qualification_label: string;
  experience_years: number | null;
  price_text: string | null;
  match_score: number;
  in_requested_area: boolean;
  /** הסיבות שהשרת חישב: "באזור שלכם", "אזור סמוך", "אונליין" ועוד. */
  match_reasons: string[];
};

/**
 * למה מורה שמחוץ לאזור מופיע/ה בכל זאת. נקבע לפי מה שהשרת חישב ולא לפי
 * הטופס: מורה מאילת שמלמד/ת אונליין מוצע/ת גם להורה שלא סימן אונליין, ואז
 * "אזור סמוך" היה פשוט לא נכון.
 */
function awayReason(t: TeacherCard): { nearby: boolean; label: string } {
  const nearby = (t.match_reasons ?? []).includes("אזור סמוך");
  if (!nearby) return { nearby, label: "אונליין" };
  return { nearby, label: t.online ? "אזור סמוך, גם אונליין" : "אזור סמוך" };
}

export default function TeacherMatchSection({
  referralKey,
  gradeGroup,
  quizType,
}: {
  /** מפתח ההמלצה, למשל "הוראה מתקנת - חשבון". */
  referralKey: string;
  gradeGroup: TeacherGradeGroup | null;
  quizType: "kids" | "school";
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
  const local = results.filter((m) => m.in_requested_area);
  const away = results.filter((m) => !m.in_requested_area);
  const ordered = located ? [...local, ...away] : results;
  const localCount = located ? local.length : results.length;
  const awayNearby = away.some((t) => awayReason(t).nearby);
  const awayOnlineOnly = away.some((t) => !awayReason(t).nearby);
  const awayKinds =
    awayNearby && awayOnlineOnly
      ? "מורים מאזורים סמוכים, ומורים שמלמדים אונליין"
      : awayNearby
        ? "מורים מאזורים סמוכים"
        : "מורים שמלמדים אונליין";

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
          <p className="text-xs text-gray-500 mb-4">מורים שההכשרה שלהם אומתה, לפי התחום ושכבת הגיל. הפנייה היא ישירות למורה.</p>

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
          {results.length === 0 ? (
            <div className="rounded-2xl bg-sky-50 px-5 py-6 text-center text-sm leading-6 text-[#2a3a5a]">
              <p className="font-bold">לא נמצאו מורים מתאימים לפי הפרמטרים שנבחרו.</p>
              <p className="mt-1 text-xs text-gray-500">המאגר של המענה הלימודי חדש ועדיין נבנה. אפשר לנסות בלי עיר, או לסמן אונליין. ההמלצה עצמה תקפה גם דרך בית הספר.</p>
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-[var(--teal-dark)] mb-3">{results.length === 1 ? "נמצא/ה מורה אחד/ת:" : `נמצאו ${results.length} מורים:`}</div>
              <div className="space-y-4">
                {ordered.map((t, idx) => {
                  const isAway = located && !t.in_requested_area;
                  const href = t.slug ? `${teacherPath(t.slug)}?from=match${quizType === "school" ? "&q=school" : ""}` : null;
                  return (
                    <div key={t.id}>
                      {located && idx === 0 && localCount > 0 && localCount < ordered.length && (
                        <div className="mb-3 flex items-center gap-2 pt-1">
                          <span className="text-sm font-extrabold text-[var(--teal-dark)]">באזור שבחרתם</span>
                          <span className="h-px flex-1 bg-[var(--line)]" />
                        </div>
                      )}
                      {isAway && idx === localCount && (
                        <div className="mb-3 pt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-[var(--text-2)]">מחוץ לאזור שבחרתם</span>
                            <span className="h-px flex-1 bg-[var(--line)]" />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                            {localCount === 0 ? `לא מצאנו מורים באזור שבחרתם. אלה האפשרויות הקרובות ביותר: ${awayKinds}.` : `${awayKinds}.`}
                          </p>
                        </div>
                      )}
                      <MatchResultCard
                        name={t.full_name}
                        isCenter={false}
                        photoUrl={t.photo_url}
                        gender={t.gender}
                        subtitle={`${t.remedial ? "הוראה מתקנת" : "מורה פרטי/ת"} • ${t.subject_labels.join(", ")} • ${t.online ? "גם אונליין" : "פנים אל פנים"}`}
                        bio={t.bio}
                        regions={t.regions}
                        inAreaChip={located && t.in_requested_area ? "✓ באזור שלכם" : null}
                        badge={
                          <p className="mt-1.5 text-xs text-[var(--muted)]">
                            🎓 {t.qualification_label}
                            {t.experience_years != null ? ` · ${t.experience_years} שנות ניסיון` : ""} · {t.grade_labels.join(", ")}
                            {t.price_text ? ` · ${t.price_text}` : ""}
                          </p>
                        }
                        score={
                          isAway
                            ? { kind: "words", label: t.match_score >= 90 ? "התאמה מלאה" : "התאמה טובה", reason: awayReason(t).label }
                            : { kind: "percent", overall: t.match_score, professional: null, personality: null }
                        }
                        actions={
                          <>
                            <TeacherContactButtons teacherId={t.id} phone={t.phone} ctx={ctx} />
                            {href && (
                              // כרטיסייה חדשה: דוח השאלון נשאר פתוח מאחור, ואין מה לשחזר בחזרה.
                              <a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[var(--line)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--text-2)] hover:border-[var(--teal)]">
                                פרופיל מלא ↗
                              </a>
                            )}
                          </>
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                המורים עצמאיים. טיפול חכם אימתה את ההכשרה המוצהרת מול תעודה, ואינה צד לשיעורים או לתשלום.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
