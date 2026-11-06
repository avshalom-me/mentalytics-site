import Link from "next/link";
import { LEARNING_BRAND, LEARNING_SIGNATURE } from "@/app/lib/learning-door";
import type { DirectoryTeacher } from "@/app/lib/teacher-card";
import TeachersDirectory, { type DirectoryFixed } from "./TeachersDirectory";

// התבנית המשותפת של עמוד תחום ועמוד עיר במאגר (app/lib/learning-landings.ts):
// כותרת, פסקת פתיחה ייחודית, שורת היצע מהנתונים, המאגר עם הסינון של העמוד,
// מדריך קשור, עמודים פתוחים אחרים והשאלון. JSON-LD של CollectionPage ופירורי לחם.

const BASE = "https://www.mentalytics.co.il";

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\u003c");
}

export type LandingLink = { href: string; label: string };

export default function LandingView(props: {
  path: string;
  crumb: string;
  h1: string;
  sub: string;
  title: string;
  description: string;
  intro: string[];
  summary: string;
  teachers: DirectoryTeacher[];
  fixed: DirectoryFixed;
  serverDay: string;
  article?: LandingLink;
  related: LandingLink[];
}) {
  const url = `${BASE}${props.path}`;
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: props.title,
    description: props.description,
    url,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
  };
  const crumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: LEARNING_BRAND, item: `${BASE}/learning` },
      { "@type": "ListItem", position: 2, name: "מאגר המורים", item: `${BASE}/learning/teachers` },
      { "@type": "ListItem", position: 3, name: props.crumb, item: url },
    ],
  };

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-4xl bg-white px-5 py-10 pb-24" style={{ color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(pageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbsLd) }} />

      <nav aria-label="מיקום באתר" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/learning" className="hover:text-[var(--teal)]">{LEARNING_BRAND}</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/learning/teachers" className="hover:text-[var(--teal)]">מאגר המורים</Link>
        <span aria-hidden="true"> / </span>
        <span>{props.crumb}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[clamp(1.7rem,3.4vw,2.5rem)] font-black leading-tight">
          {props.h1} <span className="block text-[0.62em] font-extrabold text-[var(--teal-dark)]">{props.sub}</span>
        </h1>
        <Link href="/learning/join" className="whitespace-nowrap rounded-full border-[1.5px] border-[var(--teal)] bg-white px-5 py-2 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
          מורים: הצטרפות למאגר
        </Link>
      </div>

      <div className="mb-7 max-w-[62ch] space-y-3 leading-8 text-[var(--text-2)]">
        {props.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="font-bold text-[var(--text)]">{props.summary}</p>
      </div>

      <TeachersDirectory teachers={props.teachers} serverDay={props.serverDay} fixed={props.fixed} />

      {props.article && (
        <p className="mt-10 rounded-[18px] p-5 leading-7" style={{ background: "var(--teal-pale)" }}>
          <span className="font-bold text-[var(--teal-dark)]">מדריך להורים: </span>
          <Link href={props.article.href} className="font-bold text-[var(--teal-dark)] underline underline-offset-4">
            {props.article.label}
          </Link>
        </p>
      )}

      {props.related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold">עוד במאגר</h2>
          <ul className="mt-3 flex list-none flex-wrap gap-2">
            {props.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="inline-block rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--teal-dark)] hover:bg-[var(--surface)]">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 rounded-[20px] p-6 sm:p-8" style={{ background: "var(--gold-pale)" }}>
        <h2 className="text-xl font-black text-[var(--gold-dark)]">לא בטוחים איזה מורה לחפש?</h2>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-[var(--text-2)]">
          השאלון לילדים ולנוער של טיפול חכם עובר על התחומים ומציע כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול. הוא אינו אבחון.
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
        {LEARNING_SIGNATURE}
      </p>
    </main>
  );
}
