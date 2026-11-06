import type { Metadata } from "next";
import Link from "next/link";
import { LEARNING_BRAND, LEARNING_OG_IMAGE, LEARNING_SIGNATURE, learningRobots } from "@/app/lib/learning-door";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_ARTICLES, articlePath } from "./content";

// אינדקס המדריכים להורים של "לימוד חכם": שבעת המאמרים בסדר הסדרה (העוגן
// ראשון). מקושר מהכותרת העליונה של הדלת ומדף הנחיתה.

const BASE = "https://www.mentalytics.co.il";
const TITLE = "מדריכים להורים: הוראה מתקנת, מורה פרטי, קריאה וחשבון";
const DESCRIPTION = "מדריכים קצרים להורים: מה זה הוראה מתקנת ומתי מתחילים, מורה פרטי או הוראה מתקנת, ילד שמתקשה בקריאה או בחשבון, מחירים והחזרים. בלי שיווק, עם מקורות.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | ${LEARNING_BRAND}` },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/learning/articles` },
  robots: learningRobots(),
  ...shareMetadata({ title: `${TITLE} | ${LEARNING_BRAND}`, description: DESCRIPTION, url: `${BASE}/learning/articles`, image: LEARNING_OG_IMAGE }),
};

export default function LearningArticlesIndex() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${TITLE} | ${LEARNING_BRAND}`,
    description: DESCRIPTION,
    url: `${BASE}/learning/articles`,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
    hasPart: LEARNING_ARTICLES.map((a) => ({ "@type": "Article", headline: a.title, url: `${BASE}${articlePath(a)}` })),
  };
  return (
    <main dir="rtl" className="min-h-screen bg-white" style={{ color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-10 sm:pt-14">
        <p className="text-sm font-bold text-[var(--gold-dark)]">{LEARNING_BRAND} · מדריכים להורים</p>
        <h1 className="mt-3 text-[clamp(1.9rem,4.6vw,3rem)] font-black leading-[1.15]">הוראה מתקנת, מורה פרטי, קריאה וחשבון: מה כדאי לדעת</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-8 text-[var(--text-2)]">
          שבעה מדריכים קצרים, בסדר שבו הורים בדרך כלל שואלים. כל אחד מסביר, לא משכנע, ומסתיים בשני כפתורים: למאגר המורים ולשאלון שמציע כיוון.
        </p>
        <ol className="mt-9 grid list-none gap-4 md:grid-cols-2">
          {LEARNING_ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link href={articlePath(a)} className="group block h-full rounded-[18px] bg-white p-6 transition-colors hover:bg-[var(--surface)]" style={{ border: "1px solid var(--line)" }}>
                <span className="text-xs font-bold text-[var(--gold-dark)]">מדריך {a.n}</span>
                <h2 className="mt-1 text-lg font-extrabold leading-snug text-[var(--teal-dark)] group-hover:underline">{a.title}</h2>
                <p className="mt-2 text-[15px] leading-7 text-[var(--text-2)]">{a.description}</p>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm leading-7 text-[var(--muted)]">
          <span className="font-bold text-[var(--text-2)]">{LEARNING_SIGNATURE}</span>
          <br />
          {LEARNING_BRAND} הוא חלק מ<Link href="/" className="underline underline-offset-4">טיפול חכם</Link>.
        </p>
      </section>
    </main>
  );
}
