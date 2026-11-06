import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_BRAND, LEARNING_OG_IMAGE } from "@/app/lib/learning-door";
import { loadDirectoryTeachers } from "@/app/lib/teachers.server";
import { cityLandingPath, landingRowsOf, learningLandings, subjectLandingBySlug, subjectLandingOpen, subjectLandingPath } from "@/app/lib/learning-landings";
import { articleByN, articlePath } from "@/app/learning/articles/content";
import LandingView from "../../LandingView";

/**
 * עמוד תחום במאגר המורים (/learning/teachers/subject/<תחום>). קיים רק מחמישה
 * מורים מוצגים בתחום (learning-landings.ts); מתחת לזה מפנה למאגר עם הסינון.
 * נבנה מחדש כל חמש דקות, כמו המאגר, כדי שהעמוד ייפתח עם אישור המורה החמישי/ת.
 */
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

const BASE = "https://www.mentalytics.co.il";
const getTeachers = cache(() => loadDirectoryTeachers());

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const landing = subjectLandingBySlug((await params).subject);
  if (!landing) return {};
  const open = subjectLandingOpen(landingRowsOf(await getTeachers()), landing.subject).open;
  const path = subjectLandingPath(landing);
  return {
    title: { absolute: `${landing.title} | ${LEARNING_BRAND}` },
    description: landing.description,
    alternates: { canonical: `${BASE}${path}` },
    robots: { index: open, follow: true },
    ...shareMetadata({ url: path, title: `${landing.title} | ${LEARNING_BRAND}`, description: landing.description, type: "website", image: LEARNING_OG_IMAGE }),
  };
}

export default async function SubjectLandingPage({ params }: { params: Promise<{ subject: string }> }) {
  const landing = subjectLandingBySlug((await params).subject);
  if (!landing) notFound();
  const teachers = await getTeachers();
  const rows = landingRowsOf(teachers);
  if (!subjectLandingOpen(rows, landing.subject).open) redirect(`/learning/teachers?subject=${landing.subject}`);

  const inSubject = teachers.filter((t) => (t.subjects ?? []).includes(landing.subject));
  const remedial = inSubject.filter((t) => t.remedial).length;
  const online = inSubject.filter((t) => t.online).length;
  // עמוד תחום פתוח רק מחמישה מורים, ולכן תמיד ברבים.
  const facts = [`במאגר ${inSubject.length} ${landing.h1}`, ...(remedial ? [`הוראה מתקנת: ${remedial}`] : []), ...(online ? [`מלמדים גם אונליין: ${online}`] : [])];
  const open = learningLandings(rows);
  const article = landing.article ? articleByN(landing.article) : undefined;

  return (
    <LandingView
      path={subjectLandingPath(landing)}
      crumb={landing.h1}
      h1={landing.h1}
      sub={landing.sub}
      title={landing.title}
      description={landing.description}
      intro={landing.intro}
      summary={`${facts.join(" · ")}.`}
      teachers={teachers}
      fixed={{ subject: landing.subject }}
      serverDay={new Date().toISOString().slice(0, 10)}
      article={article ? { href: articlePath(article), label: article.title } : undefined}
      related={[
        ...open.subjects.filter((s) => s.landing.subject !== landing.subject).map((s) => ({ href: subjectLandingPath(s.landing), label: s.landing.h1 })),
        ...open.cities.slice(0, 8).map((c) => ({ href: cityLandingPath(c.city), label: `מורים ב${c.city}` })),
      ]}
    />
  );
}
