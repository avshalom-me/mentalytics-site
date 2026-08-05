import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ResearchBreadcrumbLd } from "@/app/components/ResearchBreadcrumbLd";
import { ResearchArticleLd } from "@/app/components/ResearchArticleLd";
import type { SourceItem } from "./sources";
import SourcesBrowser from "./SourcesBrowser";

/**
 * Server component. The bibliography used to be fetched in a useEffect from
 * /assets/validated_sources.json, so the page shipped a spinner and 129 words -
 * and no <h1> at all - to anything that did not run JavaScript. Reading the
 * same file off disk here puts every citation in the HTML, which is the point:
 * a page whose entire value is "here are the sources behind the matching" is
 * worthless as an E-E-A-T signal if the sources are invisible to a crawler.
 */

const DATA_PATH = path.join(process.cwd(), "public", "assets", "validated_sources.json");

// Revalidate daily - the file only changes on deploy, but this keeps the page
// static without pinning it to a single build.
export const revalidate = 86400;

async function readSources(): Promise<SourceItem[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const json = JSON.parse(raw);
    return Array.isArray(json) ? (json as SourceItem[]) : [];
  } catch {
    // A missing or malformed file must not take the route down; the page still
    // renders its heading and explanation, just with an empty list.
    return [];
  }
}

export default async function AcademicArticlesPage() {
  const items = await readSources();

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <ResearchBreadcrumbLd slug="academic" title="המאמרים האקדמאיים" />
      <ResearchArticleLd
        slug="academic"
        type="CollectionPage"
        headline="המאמרים האקדמאיים שמאחורי ההתאמה"
        description="מאות המחקרים שעליהם נבנו השאלונים ואלגוריתם ההתאמה, עם סטטוס אימות לכל מקור וקישור ל-DOI או לעמוד המקורי."
        section="מחקר"
      />

      <Link href="/research" className="mb-6 inline-block text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← חזרה למאמרים ומידע שימושי
      </Link>

      <h1 className="mb-3 text-3xl font-black" style={{ color: "var(--text)" }}>
        המאמרים האקדמאיים
      </h1>
      <p className="mb-8 leading-7" style={{ color: "var(--text-2)" }}>
        השאלונים וההתאמה בנויים על בסיס מחקר בן כשנתיים המבוסס על מאות מחקרים אקדמאיים. אנו מצרפים כאן
        את המאמרים הללו ואת המקורות שלהם, כולל סטטוס האימות של כל אחד - כדי שאפשר יהיה לבדוק אותנו.
      </p>

      {items.length > 0 ? (
        <SourcesBrowser items={items} />
      ) : (
        <p className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
          רשימת המקורות אינה זמינה כרגע.
        </p>
      )}

      <details className="mt-6 rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <summary className="cursor-pointer font-semibold" style={{ color: "var(--text)" }}>
          הערות על סטטוס אימות
        </summary>
        <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-2)" }}>
          <strong>verified</strong> = יש DOI או קישור רשמי. <strong>corrected</strong> = תוקן מול המקור.{" "}
          <strong>unverified</strong> = חסרים פרטים, אין DOI או קישור רשמי.
        </p>
      </details>
    </main>
  );
}
