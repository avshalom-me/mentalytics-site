import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { slugToRegion } from "@/app/lib/regions";
import { loadRegionReport } from "@/app/lib/region-report";

// עמוד שיתוף חי: "כמה חשיפה ולחיצות מקבל מטפל/ת מקודמ/ת באזור X", לשליחה
// למרכזים טיפוליים שמתלבטים אם להצטרף (17/8/2026). קודם הופק כארטיפקט
// חד-פעמי; הועבר לכאן כי (א) קישור claude.ai לא מתאים לשליחה ללקוח עסקי,
// (ב) ארטיפקט הוא תמונת-מצב קפואה - עמוד באתר מחושב מחדש בכל טעינה.
//
// לא מקושר משום מקום באתר ולא ב-sitemap - קישור ישיר בלבד, נשלח ידנית לכל
// מרכז. robots.ts כבר חוסם רק /admin/ ו-/api/, ולכן noindex מוצהר כאן מפורשות.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region: slug } = await params;
  const region = slugToRegion(slug);
  if (!region) return { title: "אזור לא נמצא", robots: { index: false, follow: false } };
  return {
    title: `נתוני חשיפה ולחיצות - אזור ${region}`,
    description: `כמה חשיפה ולחיצות ליצירת קשר מקבלים מטפלים מקודמים באזור ${region}, מתוך נתוני האתר בזמן אמת.`,
    robots: { index: false, follow: false },
  };
}

function fmt(n: number): string {
  return n.toLocaleString("he-IL");
}

export default async function RegionDataPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: slug } = await params;
  const region = slugToRegion(slug);
  if (!region) notFound();

  const report = await loadRegionReport(region);
  if (!report) notFound();

  const generated = new Date(report.generatedAt).toLocaleDateString("he-IL", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <main dir="rtl" className="mx-auto max-w-2xl px-5 py-16 pb-24">
      <header>
        <p className="mb-2 text-[13px] font-bold tracking-wide" style={{ color: "var(--muted)" }}>
          טיפול חכם · אזור {region}
        </p>
        <h1 className="text-3xl font-black leading-tight text-stone-900 md:text-4xl">
          צפיות ולחיצות ליצירת קשר
        </h1>
        <p className="mt-3 max-w-lg text-[15.5px] leading-7" style={{ color: "var(--text-2)" }}>
          {report.windowDays} הימים האחרונים, אצל {fmt(report.therapistCount)} מטפלים מקודמים
          (בתשלום או במתנה) באזור {region}.
        </p>
      </header>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="text-[40px] font-black leading-none" style={{ color: "var(--teal-dark)" }}>{fmt(report.totalViews)}</div>
          <div className="mt-2 text-[15px] font-bold text-stone-900">צפיות בפרופיל</div>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>{fmt(report.uniqueViewers)} אנשים שונים</div>
        </div>
        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="text-[40px] font-black leading-none" style={{ color: "var(--teal-dark)" }}>{fmt(report.totalClicks)}</div>
          <div className="mt-2 text-[15px] font-bold text-stone-900">לחיצות ליצירת קשר</div>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>{fmt(report.uniqueClickers)} אנשים שונים</div>
        </div>
        <div className="col-span-2 rounded-2xl p-6 sm:col-span-1" style={{ background: "var(--gold-pale)", border: "1px solid var(--gold)" }}>
          <div className="text-[40px] font-black leading-none" style={{ color: "var(--gold-dark)" }}>{report.avgClicksPerMonth}</div>
          <div className="mt-2 text-[15px] font-bold text-stone-900">למטפל/ת בחודש</div>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>לחיצות ליצירת קשר</div>
        </div>
      </section>

      <p className="mt-4 rounded-2xl p-4 text-[14px] leading-6" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
        הממוצע מחושב לפי זמן ההופעה בפועל, כך שמטפל/ת שהצטרפ/ה באמצע התקופה
        אינ/ה מדלל/ת אותו. <strong className="text-stone-900">הפיזור רחב</strong>:
        בפועל נע בין {report.clicksMin} ל-{report.clicksMax} לחיצות למטפל/ת,
        והחציון הוא {report.clicksMedian}. מי שהפרופיל שלו/ה מלא ומעודכן מקבל/ת
        משמעותית יותר.
      </p>

      {report.specialties.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[19px] font-black text-stone-900">לפי תחום טיפול</h2>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--muted)" }}>
            מטפל/ת שמסמנ/ת כמה תחומים נספר/ת בכל אחד מהם, ולכן{" "}
            <strong className="text-stone-900">אין לסכם את השורות</strong> - הסכום הכולל הוא זה שלמעלה.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--line)" }}>
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-start text-[13px] font-black" style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", borderBottom: "1px solid var(--teal-mid)" }}>תחום</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center text-[13px] font-black" style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", borderBottom: "1px solid var(--teal-mid)" }}>מטפלים</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center text-[13px] font-black" style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", borderBottom: "1px solid var(--teal-mid)" }}>צפיות</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center text-[13px] font-black" style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", borderBottom: "1px solid var(--teal-mid)" }}>לחיצות</th>
                </tr>
              </thead>
              <tbody>
                {report.specialties.map((s, i) => (
                  <tr key={s.area} style={i % 2 === 1 ? { background: "var(--surface)" } : undefined}>
                    <td className="px-4 py-3 font-semibold text-stone-900" style={{ borderBottom: "1px solid var(--line)" }}>{s.area}</td>
                    <td className="px-4 py-3 text-center font-bold text-stone-900" style={{ borderBottom: "1px solid var(--line)" }}>{fmt(s.therapists)}</td>
                    <td className="px-4 py-3 text-center font-bold text-stone-900" style={{ borderBottom: "1px solid var(--line)" }}>{fmt(s.views)}</td>
                    <td className="px-4 py-3 text-center font-bold text-stone-900" style={{ borderBottom: "1px solid var(--line)" }}>{fmt(s.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-12 border-t pt-7" style={{ borderColor: "var(--line)" }}>
        <h2 className="text-[15.5px] font-black text-stone-900">מה נספר כאן</h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-6" style={{ color: "var(--text-2)" }}>
          <li><strong className="text-stone-900">צפייה</strong> = כניסה לעמוד הפרופיל המלא, מתוך תוצאות ההתאמה או מהמאגר.</li>
          <li><strong className="text-stone-900">לחיצה ליצירת קשר</strong> = לחיצה על וואטסאפ, חיוג או מייל. רגע שבו אדם ביקש ליצור קשר - לא אישור שהטיפול יצא לדרך.</li>
          <li><strong className="text-stone-900">אנשים שונים</strong> נספרו לפי מזהה ייחודי, כך שמי שחזר פעמיים אינו נספר פעמיים.</li>
          <li>תנועת סורקים אוטומטיים אינה נכללת.</li>
        </ul>
        <p className="mt-6 text-[13px]" style={{ color: "var(--faint)" }}>
          מחושב בזמן אמת ממסד הנתונים של טיפול חכם · עודכן {generated}
        </p>
      </section>

      <div className="mt-10 rounded-2xl p-6 text-center" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <p className="text-[15px] leading-6" style={{ color: "var(--text-2)" }}>
          פרטים על הצטרפות מרכזים טיפוליים למערכת ההתאמות:
        </p>
        <Link
          href="/centers"
          className="mt-3 inline-block rounded-full px-6 py-2.5 text-[14.5px] font-bold text-white"
          style={{ background: "var(--teal)" }}
        >
          mentalytics.co.il/centers
        </Link>
      </div>
    </main>
  );
}
