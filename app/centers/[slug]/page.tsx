import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicCenterBySlug, signCenterAssets } from "@/app/lib/center-public";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import CenterProfile from "./CenterProfile";

// עמוד מרכז ציבורי (SEO). שני המסלולים מרונדרים ב-CenterProfile (עיצוב
// "הקשתות"): מסלול 1 - עם רשימת מטפלי המרכז ושאלון ההתאמה; מסלול 2 (מרכז
// כישות) - פנייה ישירה למרכז עם מעקב על שורת הישות. גלוי רק למרכז פעיל
// (getPublicCenterBySlug אוכף: מסלול 1 דורש הדלקה מפורשת של העמוד).

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

type CenterEntity = {
  id: string;
  status: string;
  email: string | null;
  accepting_new_patients: boolean | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  regions: string[] | null;
  online: boolean | null;
  languages: string[] | null;
  arrangements: string[] | null;
};

async function getCenterEntity(centerId: string): Promise<CenterEntity | null> {
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, status, email, accepting_new_patients, therapist_types, training_areas, regions, online, languages, arrangements")
    .eq("center_account_id", centerId)
    .eq("entity_type", "center")
    .maybeSingle();
  return (data as CenterEntity | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) return { title: "מרכז לא נמצא", robots: { index: false, follow: false } };

  const cityPart = center.public_city ? ` ב${center.public_city}` : "";
  // בלי "| טיפול חכם" - תבנית ה-layout כבר מוסיפה את המותג (אחרת הוא מוכפל).
  const title = `${center.name} - מרכז טיפולי${cityPart}`;
  const description =
    (center.public_description?.trim()?.slice(0, 155)) ||
    `${center.name} - מרכז טיפולי${cityPart}. הכירו את המרכז והצוות, וקבעו התאמה אישית דרך טיפול חכם.`;
  const url = `${BASE}/centers/${center.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: [{ url: `${BASE}/logo.svg.png`, alt: center.name }] },
  };
}

export default async function CenterPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) notFound();

  // הגעה מתוצאות ההתאמות (?from=match) - הצפייה נרשמת כ-match ולא directory,
  // כדי שמשפך המרכז בפורטל (הופעה→כניסה) יהיה קוהרנטי.
  const sp = searchParams ? await searchParams : undefined;
  const viewSource: "match" | "directory" = sp?.from === "match" ? "match" : "directory";

  const isEntity = center.billing_track === "center_entity";
  const [assets, entity, therapists] = await Promise.all([
    signCenterAssets(center),
    isEntity ? getCenterEntity(center.id) : Promise.resolve(null),
    isEntity ? Promise.resolve([]) : loadPublicTherapists({ centerId: center.id }),
  ]);

  return <CenterProfile center={center} entity={entity} assets={assets} viewSource={viewSource} therapists={therapists} />;
}
