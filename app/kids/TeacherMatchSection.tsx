"use client";

import { useEffect, useState } from "react";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import MatchResultCard from "@/app/components/MatchResultCard";
import TeacherContactButtons, { useTeacherImpressions } from "@/app/learning/TeacherContactButtons";
import { teacherPath, teacherSearchFromKey, type TeacherGradeGroup } from "@/app/lib/teacher-options";
import { trackMatchingClick, trackMatchSearch, trackMatchResults, type QuizType } from "@/app/lib/useTrack";

// מסך חיפוש המורים בתוך שאלון הילדים - המקבילה של KidsMatchSection לכרטיס
// מסוג "teacher". קורא ל-/api/match-teachers (טבלת המורים בלבד), ומציג
// כרטיסים באותה צורה שההורים כבר מכירים: "באזור שבחרתם" ואחריה הסביבה.
// אין כאן ציון אישיותי ואין "למה הותאם לי": ההתאמה היא תחום, סוג מורה,
// שכבת גיל ומרחק, וזה נאמר בכרטיס במילים.

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
  match_reasons: string[];
};

export default function TeacherMatchSection({
  referralKey,
  gradeGroup,
  quizType,
}: {
  /** מפתח ההמלצה, למשל "הוראה מתקנת - חשבון". */
  referralKey: string;
  gradeGroup: TeacherGradeGroup | null;
  quizType: QuizType;
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
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setResults([]);
    setSearched(false);
    setError("");
  }, [referralKey]);

  useTeacherImpressions(results.map((t) => t.id), { source: "match", quizType: quizType === "adults" ? null : quizType, subject: search.subject });

  async function doMatch() {
    setLoading(true);
    setError("");
    trackMatchSearch(quizType, { region: region || null, city: city || null, online }, "teacher");
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
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "שגיאה בחיפוש");
      const matches: TeacherCard[] = data.matches || [];
      setResults(matches);
      trackMatchResults(
        quizType,
        {
          region: region || null,
          city: city || null,
          online,
          returned: matches.length,
          local: city || region ? matches.filter((m) => m.in_requested_area).length : undefined,
        },
        "teacher",
      );
      setSearched(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בחיפוש");
    } finally {
      setLoading(false);
    }
  }

  const locationAsked = !!(city || region);
  const local = results.filter((m) => m.in_requested_area);
  const away = results.filter((m) => !m.in_requested_area);
  const ordered = locationAsked ? [...local, ...away] : results;
  const localCount = locationAsked ? local.length : results.length;

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            trackMatchingClick(quizType, `teacher:${referralKey}`);
          }}
          className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md transition hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#1d5f8a,#2f88b8)" }}
        >
          🎓 מציאת {search.label} - באזורכם
        </button>
      ) : (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="font-bold text-[var(--teal-dark)] text-lg mb-1">מציאת {search.label}</h3>
          <p className="text-xs text-gray-500 mb-4">מורים שההכשרה שלהם אומתה, לפי התחום ושכבת הגיל של הילד/ה. ההורים פונים ישירות למורה.</p>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#2a3a5a] cursor-pointer">
              <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="w-4 h-4" />
              פתוחים גם לשיעורים אונליין
            </label>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">אזור מגורים</label>
            <select value={region} onChange={(e) => { setRegion(e.target.value); setCity(""); }} className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm mb-2">
              <option value="">-- בחר אזור --</option>
              {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {region && (
              <>
                <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">עיר</label>
                <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm">
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
              <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">שפת ההוראה</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm">
                {["עברית", "אנגלית", "ערבית", "רוסית", "צרפתית", "ספרדית", "אמהרית"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <div className="text-sm font-semibold text-[#2a3a5a] mb-2">העדפת מגדר</div>
              <div className="flex gap-4">
                {(["", "זכר", "נקבה"] as const).map((g) => (
                  <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={gender === g} onChange={() => setGender(g)} />
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

      {searched && (
        <div className="mt-5">
          {results.length === 0 ? (
            <div className="rounded-2xl bg-sky-50 px-5 py-6 text-center text-sm leading-6 text-[#2a3a5a]">
              <p className="font-bold">לא נמצאו מורים מתאימים לפי הפרמטרים שנבחרו.</p>
              <p className="mt-1 text-xs text-gray-500">המאגר של המענה הלימודי חדש ועדיין נבנה. אפשר לנסות בלי עיר, או לסמן אונליין. ההמלצה עצמה תקפה גם דרך בית הספר.</p>
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-[var(--teal-dark)] mb-3">נמצאו {results.length} מורים:</div>
              <div className="space-y-4">
                {ordered.map((t, idx) => {
                  const isAway = locationAsked && !t.in_requested_area;
                  const href = t.slug ? `${teacherPath(t.slug)}?from=match${quizType === "school" ? "&q=school" : ""}` : null;
                  return (
                    <div key={t.id}>
                      {locationAsked && idx === 0 && localCount > 0 && localCount < ordered.length && (
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
                            {localCount === 0 ? "לא מצאנו מורים באזור שבחרתם. אלה האפשרויות הקרובות ביותר" : "מורים מאזורים סמוכים"}{online ? " וכאלה שמלמדים אונליין" : ""}.
                          </p>
                        </div>
                      )}
                      <MatchResultCard
                        name={t.full_name}
                        isCenter={false}
                        photoUrl={t.photo_url}
                        gender={t.gender}
                        subtitle={`${t.remedial ? "הוראה מתקנת" : "מורה פרטי/ת"} · ${t.subject_labels.join(", ")} · ${t.online ? "אונליין" : "פנים אל פנים"}`}
                        bio={t.bio}
                        regions={t.regions}
                        inAreaChip={locationAsked && t.in_requested_area ? "✓ באזור שלכם" : null}
                        badge={
                          <p className="mt-1.5 text-xs text-[var(--muted)]">
                            🎓 {t.qualification_label}{t.experience_years != null ? ` · ${t.experience_years} שנות ניסיון` : ""} · {t.grade_labels.join(", ")}{t.price_text ? ` · ${t.price_text}` : ""}
                          </p>
                        }
                        score={isAway ? { kind: "words", label: t.match_score >= 90 ? "התאמה מלאה" : "התאמה טובה", reason: "מחוץ לאזור" } : { kind: "percent", overall: t.match_score, professional: null, personality: null }}
                        actions={
                          <>
                            <TeacherContactButtons teacherId={t.id} phone={t.phone} ctx={{ source: "match", quizType: quizType === "adults" ? null : quizType, subject: search.subject }} />
                            {href && (
                              <a href={href} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[var(--line)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--text-2)] hover:border-[var(--teal)]">
                                פרופיל מלא ←
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
