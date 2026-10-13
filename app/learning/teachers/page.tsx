import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_BRAND, LEARNING_OG_IMAGE, learningDirectoryRobots } from "@/app/lib/learning-door";
import { loadDirectoryTeachers } from "@/app/lib/teachers.server";
import TeachersDirectory from "./TeachersDirectory";

/**
 * מאגר המורים של "לימוד חכם".
 *
 * החלטת הבעלים (13/10/2026): מאגר מורים עם חיפוש לפי תחום, אזור וכו', "כמו
 * בחלק של המטפלים". עד אז הדלת (/learning) החזיקה טופס חיפוש שמחזיר תוצאות;
 * מאגר מציג את כל המורים מיד, והסינון מצמצם אותם.
 *
 * העמוד נבנה מחדש כל חמש דקות, כדי שמורה שאושר יופיע בלי פריסה. הוא נכנס
 * לאינדקס ול-sitemap רק מעל סף של מורים מוצגים (learningDirectoryRobots):
 * מאגר כמעט ריק הוא עמוד דל. עמודי הפרופיל (/learning/t) נשארים noindex.
 */
export const revalidate = 300;

// המטא והעמוד קוראים את אותה רשימה; cache חוסך את הקריאה השנייה למסד באותו רינדור.
const getTeachers = cache(() => loadDirectoryTeachers());

const URL = "https://www.mentalytics.co.il/learning/teachers";
const TITLE = "מאגר מורים להוראה מתקנת ומורים פרטיים לפי תחום ואזור";
const DESCRIPTION =
  "מורים להוראה מתקנת ומורים פרטיים לפי תחום, כיתה ואזור, כולל שיעורים אונליין. אצל מורים להוראה מתקנת ולחינוך מיוחד התעודה נבדקה.";

export async function generateMetadata(): Promise<Metadata> {
  const teachers = await getTeachers();
  return {
    // absolute: הסיומת של האתר היא "| טיפול חכם", והעמוד הזה חותם בשם של הדלת.
    title: { absolute: `${TITLE} | ${LEARNING_BRAND}` },
    description: DESCRIPTION,
    alternates: { canonical: URL },
    robots: learningDirectoryRobots(teachers.length),
    ...shareMetadata({ url: "/learning/teachers", title: `${TITLE} | ${LEARNING_BRAND}`, description: DESCRIPTION, type: "website", image: LEARNING_OG_IMAGE }),
  };
}

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function TeachersDirectoryPage() {
  const now = new Date();
  const teachers = await getTeachers();

  const pageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    url: URL,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
    about: ["הוראה מתקנת", "הוראה מותאמת", "מורים פרטיים"],
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: LEARNING_BRAND, item: "https://www.mentalytics.co.il/learning" },
      { "@type": "ListItem", position: 2, name: "מאגר המורים", item: URL },
    ],
  };

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-4xl bg-white px-5 py-10 pb-24" style={{ color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(pageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }} />

      <nav aria-label="מיקום באתר" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/learning" className="hover:text-[var(--teal)]">{LEARNING_BRAND}</Link>
        <span aria-hidden="true"> / </span>
        <span>מאגר המורים</span>
      </nav>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[clamp(1.7rem,3.4vw,2.5rem)] font-black leading-tight">
          מורים להוראה מתקנת ומורים פרטיים <span className="block text-[0.62em] font-extrabold text-[var(--teal-dark)]">לפי תחום, כיתה ואזור</span>
        </h1>
        <Link href="/learning/join" className="whitespace-nowrap rounded-full border-[1.5px] border-[var(--teal)] bg-white px-5 py-2 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
          מורים: הצטרפות למאגר
        </Link>
      </div>
      {/* הפסקה הראשונה בעמוד היא מה שגוגל מצטט מתחת לתוצאה; בלעדיה זה היה כרטיס של מורה. */}
      <p className="mb-7 max-w-[62ch] leading-8 text-[var(--text-2)]">
        מאגר המורים של {LEARNING_BRAND}, לכיתות א׳ עד י״ב. מסננים לפי תחום, כיתה ואזור, קוראים על המורה ופונים אליו ישירות בוואטסאפ
        או בטלפון. יש גם מורים שמלמדים אונליין.
      </p>

      <TeachersDirectory teachers={teachers} serverDay={now.toISOString().slice(0, 10)} />

      <section className="mt-12 rounded-[20px] p-6 sm:p-8" style={{ background: "var(--gold-pale)" }}>
        <h2 className="text-xl font-black text-[var(--gold-dark)]">לא בטוחים איזה מורה לחפש?</h2>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-[var(--text-2)]">
          לפעמים לא ברור אם הקושי לימודי, רגשי או קשור לקשב. השאלון לילדים ולנוער של טיפול חכם עובר על התחומים ומציע כיוון: הוראה
          מתקנת, מורה פרטי, אבחון או טיפול. הוא אינו אבחון.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/kids" className="inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--gold-dark)]">
            לשאלון לילדים ולנוער
          </Link>
          <Link href="/learning#which" className="inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-white px-7 py-3 text-sm font-bold text-[var(--gold-dark)] transition-colors hover:bg-white/60">
            הוראה מתקנת או מורה פרטי?
          </Link>
        </div>
      </section>

      <p className="mt-8 text-xs leading-6 text-[var(--muted)]">
        <Link href="/learning#checked" className="underline underline-offset-4">מה אנחנו בודקים, ומה לא</Link>
        <span aria-hidden="true"> · </span>
        צוות {LEARNING_BRAND}
      </p>
    </main>
  );
}
