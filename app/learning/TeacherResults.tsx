"use client";

import type { ReactNode } from "react";
import MatchResultCard from "@/app/components/MatchResultCard";
import TeacherContactButtons, { type TeacherEventContext } from "@/app/learning/TeacherContactButtons";
import { teacherPath } from "@/app/lib/teacher-options";
import type { TeacherCard } from "@/app/lib/teacher-card";

// רשימת תוצאות של חיפוש מורים: "באזור שבחרתם", ואחריה הסביבה. רכיב אחד
// לשני המקומות שמוצגים בהם מורים - מסך החיפוש בשאלון הילדים ומאגר המורים
// של "לימוד חכם" (/learning/teachers) - כדי שכרטיס מורה ייראה ויתנהג אותו
// דבר בשניהם.
//
// אין כאן ציון אישיותי ואין "למה הותאם לי": ההתאמה היא תחום, סוג מורה, שכבת
// גיל, מרחק, והקשיים שצוינו - וכל אלה נאמרים בכרטיס במילים.

export type { TeacherCard } from "@/app/lib/teacher-card";

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

export default function TeacherResults({
  results,
  located,
  ctx,
  profileQuery,
  empty,
  showScore = true,
  total,
}: {
  results: TeacherCard[];
  /** החיפוש רץ עם אזור או עיר - רק אז יש "באזור שבחרתם" ו"מחוץ לאזור". */
  located: boolean;
  ctx: TeacherEventContext;
  /** מה שמתווסף לקישור הפרופיל, למשל "from=match" או "from=direct". */
  profileQuery: string;
  /** מה שמוצג כשלא נמצא אף מורה. */
  empty: ReactNode;
  /**
   * false במאגר המורים: שם ההורה מעיין ברשימה ולא שאל שאלה שיש לה "אחוז
   * התאמה". ההתאמה לקשיים שצוינו עדיין נאמרת במילים בשורת הניסיון.
   */
  showScore?: boolean;
  /** כמה מורים נמצאו בסך הכול, כשהרשימה שהועברה היא רק העמוד הראשון שלה. */
  total?: number;
}) {
  if (results.length === 0) return <>{empty}</>;

  const count = total ?? results.length;
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
    <>
      <div className="mb-3 text-sm font-bold text-[var(--teal-dark)]">{count === 1 ? "נמצא/ה מורה אחד/ת:" : `נמצאו ${count} מורים:`}</div>
      <div className="space-y-4">
        {ordered.map((t, idx) => {
          const isAway = located && !t.in_requested_area;
          const href = t.slug ? `${teacherPath(t.slug)}?${profileQuery}` : null;
          const matched = new Set(t.need_labels ?? []);
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
                verifiedLabel={t.certificate_checked ? "✓ תעודה נבדקה" : null}
                photoUrl={t.photo_url}
                gender={t.gender}
                subtitle={`${t.remedial ? "הוראה מתקנת" : "מורה פרטי/ת"} • ${t.subject_labels.join(", ")} • ${t.lesson_text || (t.online ? "גם אונליין" : "פנים אל פנים")}`}
                bio={t.bio}
                regions={t.regions}
                inAreaChip={located && t.in_requested_area ? "✓ באזור שלכם" : null}
                badge={
                  <>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      🎓 {t.qualification_label}
                      {/* אצל מורה פרטי/ת ההכשרה אינה נבדקת, וכך היא מסומנת. */}
                      {!t.certificate_checked && " (לפי הצהרת המורה)"}
                      {t.experience_years != null ? ` · ${t.experience_years} שנות ניסיון` : ""} · {t.grade_labels.join(", ")}
                      {t.price_text ? ` · ${t.price_text}` : ""}
                    </p>
                    {t.expertise_labels?.length > 0 && (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        ניסיון מוצהר:{" "}
                        {t.expertise_labels.map((label, i) => (
                          <span key={label}>
                            {i > 0 && " · "}
                            {/* מה שמתאים לקשיים שצוינו מודגש: זו הסיבה שהמורה מופיע/ה מוקדם יותר. */}
                            {matched.has(label) ? <strong className="font-bold text-[var(--teal-dark)]">✓ {label}</strong> : label}
                          </span>
                        ))}
                      </p>
                    )}
                  </>
                }
                score={
                  !showScore
                    ? null
                    : isAway
                      ? { kind: "words", label: t.match_score >= 90 ? "התאמה מלאה" : "התאמה טובה", reason: awayReason(t).label }
                      : { kind: "percent", overall: t.match_score, professional: null, personality: null }
                }
                actions={
                  <>
                    <TeacherContactButtons teacherId={t.id} phone={t.phone} ctx={ctx} />
                    {href && (
                      // כרטיסייה חדשה: התוצאות נשארות פתוחות מאחור, ואין מה לשחזר בחזרה.
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
        המורים עצמאיים, ולימוד חכם אינו צד לשיעורים או לתשלום. תעודה נבדקה רק אצל מורים להוראה מתקנת ולחינוך מיוחד; שאר
        הפרטים הם לפי הצהרת המורה. איננו בודקים רישום פלילי.
      </p>
    </>
  );
}
