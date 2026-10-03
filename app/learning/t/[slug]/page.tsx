import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadListedTeacherBySlug, teacherPhotoUrl } from "@/app/lib/teachers.server";
import { subjectLabel, gradeGroupLabel, qualificationLabel, expertiseLabel, focusesBySubject, lessonSettingsText } from "@/app/lib/teacher-options";
import TeacherContactButtons from "../../TeacherContactButtons";
import TeacherProfileView from "./TeacherProfileView";

// עמוד הפרופיל של מורה. מוצג רק למורה שמופיע/ה כרגע (ניסיון/משלם/ת ולא
// מוקפא/ת) - אחרת 404, בלי להסגיר אם הוא/היא קיים/ת. noindex מה-layout.
// הכתובת מגיעה מכרטיס תוצאה: בשאלון הילדים (from=match) או בחיפוש הישיר
// של "לימוד חכם" (from=direct).

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await loadListedTeacherBySlug(slug);
  return { title: t ? `${t.full_name} | לימוד חכם` : "מורה", robots: { index: false, follow: false } };
}

export default async function TeacherProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const t = await loadListedTeacherBySlug(slug);
  if (!t) notFound();
  const fromMatch = sp.from === "match";
  const fromDirect = sp.from === "direct";
  const photo = teacherPhotoUrl(t);
  const focusGroups = focusesBySubject(t.subjects, t.focuses ?? []);
  const expertise = t.expertise ?? [];
  // ערים, ואחריהן איפה מתקיים השיעור: "חיפה, נשר · בבית התלמיד, אונליין".
  const where = [t.regions.join(", "), lessonSettingsText(t)].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24" dir="rtl">
      <TeacherProfileView teacherId={t.id} quizType={sp.q === "school" ? "school" : fromMatch ? "kids" : null} />
      {(fromMatch || fromDirect) && (
        <p className="mb-6 text-xs text-[var(--muted)]">
          הפרופיל נפתח בכרטיסייה חדשה. {fromMatch ? "תוצאות השאלון" : "תוצאות החיפוש"} נשארו פתוחות בכרטיסייה הקודמת.
        </p>
      )}

      <div className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
            alt={t.full_name}
            className="h-28 w-28 flex-shrink-0 rounded-2xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-[var(--text)]">{t.full_name}</h1>
              <span className="rounded-full bg-[var(--teal-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--teal-dark)]">✓ ההכשרה אומתה</span>
              {t.remedial && <span className="rounded-full bg-[var(--gold-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--gold-dark)]">הוראה מתקנת</span>}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t.remedial ? "מורה להוראה מתקנת" : "מורה פרטי/ת"} · {t.subjects.map(subjectLabel).join(", ")}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.grade_groups.map(gradeGroupLabel).join(" · ")}</p>
            {where && <p className="mt-1 text-sm text-[var(--muted)]">📍 {where}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <TeacherContactButtons teacherId={t.id} phone={t.phone} ctx={{ source: "profile", quizType: sp.q === "school" ? "school" : fromMatch ? "kids" : null }} />
        </div>

        {t.bio && <p className="mt-6 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{t.bio}</p>}

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          {focusGroups.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] p-3 sm:col-span-2">
              <dt className="text-xs font-bold text-[var(--muted)]">מוקדי הוראה</dt>
              <dd className="font-semibold text-[var(--text)]">
                {focusGroups.map((g) => (
                  <div key={g.subject}>
                    <span className="font-normal text-[var(--text-2)]">{g.label}:</span> {g.focuses.join(", ")}
                  </div>
                ))}
              </dd>
            </div>
          )}
          {expertise.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] p-3 sm:col-span-2">
              <dt className="text-xs font-bold text-[var(--muted)]">
                ניסיון בהוראה לתלמידים עם <span className="font-normal">(לפי הצהרת המורה)</span>
              </dt>
              <dd className="font-semibold text-[var(--text)]">
                <ul className="list-inside list-disc">
                  {expertise.map((k) => (
                    <li key={k}>{expertiseLabel(k)}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div className="rounded-xl bg-[var(--surface)] p-3">
            <dt className="text-xs font-bold text-[var(--muted)]">הכשרה</dt>
            <dd className="font-semibold text-[var(--text)]">{qualificationLabel(t.qualification)}</dd>
          </div>
          {t.experience_years != null && (
            <div className="rounded-xl bg-[var(--surface)] p-3">
              <dt className="text-xs font-bold text-[var(--muted)]">ניסיון</dt>
              <dd className="font-semibold text-[var(--text)]">{t.experience_years} שנים</dd>
            </div>
          )}
          {t.price_text && (
            <div className="rounded-xl bg-[var(--surface)] p-3">
              <dt className="text-xs font-bold text-[var(--muted)]">מחיר</dt>
              <dd className="font-semibold text-[var(--text)]">{t.price_text}</dd>
            </div>
          )}
          {t.languages.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] p-3">
              <dt className="text-xs font-bold text-[var(--muted)]">שפות</dt>
              <dd className="font-semibold text-[var(--text)]">{t.languages.join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>

      <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
        מורה עצמאי/ת. טיפול חכם אימתה את ההכשרה המוצהרת מול תעודה, ואינה צד לשיעורים, לתשלום או לתוכנם.
        מוקדי ההוראה והניסיון עם קשיים מסוימים הם לפי הצהרת המורה, ולא אומתו.
        המורה אינו/ה מטפל/ת ואינו/ה מאבחן/ת; לקושי רגשי או לבירור אבחוני,{" "}
        {fromMatch ? "ראו את שאר ההמלצות בדוח השאלון." : "פונים לאנשי המקצוע המתאימים."}
      </p>
    </main>
  );
}
