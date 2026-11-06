import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_BRAND, LEARNING_OG_IMAGE } from "@/app/lib/learning-door";
import { loadDirectoryTeachers } from "@/app/lib/teachers.server";
import { neighborsOf, slugToCity } from "@/app/lib/regions";
import { cityLandingOpen, cityLandingPath, landingRowsOf, learningLandings, subjectLandingPath } from "@/app/lib/learning-landings";
import LandingView from "../../LandingView";

/**
 * עמוד עיר במאגר המורים (/learning/teachers/city/<עיר>). קיים רק משלושה מורים
 * שמלמדים בעיר, או ממורה אחד/ת בעיר וחמישה בה ובערים הצמודות
 * (learning-landings.ts); מתחת לזה מפנה למאגר עם הסינון של העיר.
 */
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

const BASE = "https://www.mentalytics.co.il";
const getTeachers = cache(() => loadDirectoryTeachers());

const titleFor = (city: string) => `מורה פרטי והוראה מתקנת ב${city}`;
const descriptionFor = (city: string) =>
  `מורים פרטיים ומורים להוראה מתקנת ב${city}: קריאה וכתיבה, חשבון, אנגלית ועוד, לפי תחום וכיתה, עם פנייה ישירה למורה. אצל מורים להוראה מתקנת התעודה נבדקה.`;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = slugToCity((await params).city);
  if (!city) return {};
  const open = cityLandingOpen(landingRowsOf(await getTeachers()), city).open;
  const path = cityLandingPath(city);
  return {
    title: { absolute: `${titleFor(city)} | ${LEARNING_BRAND}` },
    description: descriptionFor(city),
    alternates: { canonical: `${BASE}${path}` },
    robots: { index: open, follow: true },
    ...shareMetadata({ url: path, title: `${titleFor(city)} | ${LEARNING_BRAND}`, description: descriptionFor(city), type: "website", image: LEARNING_OG_IMAGE }),
  };
}

export default async function CityLandingPage({ params }: { params: Promise<{ city: string }> }) {
  const city = slugToCity((await params).city);
  if (!city) notFound();
  const teachers = await getTeachers();
  const rows = landingRowsOf(teachers);
  const state = cityLandingOpen(rows, city);
  if (!state.open) redirect(`/learning/teachers?city=${encodeURIComponent(city)}`);

  const local = teachers.filter((t) => (t.regions ?? []).includes(city));
  const remedial = local.filter((t) => t.remedial).length;
  const facts = [
    state.inCity === 1 ? `במאגר מורה אחד/ת שמלמד/ת ב${city}` : `במאגר ${state.inCity} מורים שמלמדים ב${city}`,
    ...(state.nearby > state.inCity ? [`בערים הצמודות: עוד ${state.nearby - state.inCity}`] : []),
    ...(remedial ? [`הוראה מתקנת: ${remedial}`] : []),
  ];
  const open = learningLandings(rows);
  const near = new Set(neighborsOf(city));
  const otherCities = open.cities.filter((c) => c.city !== city).sort((a, b) => Number(near.has(b.city)) - Number(near.has(a.city)));

  return (
    <LandingView
      path={cityLandingPath(city)}
      crumb={city}
      h1={`מורים פרטיים ומורים להוראה מתקנת ב${city}`}
      sub="לפי תחום וכיתה, עם פנייה ישירה"
      title={titleFor(city)}
      description={descriptionFor(city)}
      intro={[
        `מורים שמלמדים ב${city}${near.size ? " ובסביבה" : ""}: הוראה מתקנת, קריאה וכתיבה, חשבון, אנגלית ועוד, לכיתות א׳ עד י״ב. מסננים לפי תחום וכיתה, קוראים על המורה ופונים ישירות בוואטסאפ או בטלפון.`,
        "מורים מהעיר מופיעים ראשונים, ואחריהם מורים מהסביבה ומורים שמלמדים אונליין.",
      ]}
      summary={`${facts.join(" · ")}.`}
      teachers={teachers}
      fixed={{ city }}
      serverDay={new Date().toISOString().slice(0, 10)}
      related={[
        ...otherCities.slice(0, 8).map((c) => ({ href: cityLandingPath(c.city), label: `מורים ב${c.city}` })),
        ...open.subjects.map((s) => ({ href: subjectLandingPath(s.landing), label: s.landing.h1 })),
      ]}
    />
  );
}
