import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import { genderTitle } from "@/app/lib/gender-text";
import {
  slugToCityTopic,
  isOnlineTopicAllowed,
  onlineTopicSlugs,
  MIN_ONLINE_TOPIC,
  TOPICS,
} from "@/app/lib/topics";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";

// Online×topic (phase 3 of the online cluster - see ONLINE_TOPIC_SLUGS in
// app/lib/topics.ts): "טיפול בחרדה אונליין", "טיפול זוגי אונליין". Same
// anti-doorway discipline as the city×topic pilot it mirrors: allow-listed
// combos only, indexable only at ≥MIN_ONLINE_TOPIC listed therapists,
// everything else noindex or 404.
//
// The listing overlap with the parent online page is real (the חרדה filter
// matches most online therapists), which is exactly the city-pilot situation -
// so the differentiation burden falls on the prose: each page carries the
// topic's own intro plus an online-specific note. Those notes cite only
// sources verified against their records (see /research/online-therapy);
// where no direct evidence exists (couples, kids) they say something honest
// and practical instead of inventing a study.

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return onlineTopicSlugs().map((topic) => ({ topic }));
}

/**
 * What online delivery specifically means for this topic - the paragraph that
 * makes this page more than a filtered copy of the parent. Keyed by slug;
 * approaches key by name-slug.
 */
const ONLINE_NOTES: Record<string, string> = {
  "טיפול-בחרדה":
    "על פי המחקרים האחרונים בתחום הטיפול, נראה כי יש הצלחה רבה יחסית לטיפול אונליין בתחום החרדה. למשל, מטא-אנליזה של טיפול בשיחת וידאו (Fernandez ועמיתיו, 2021) מצאה שהאפקט הבולט ביותר (דהיינו – הצלחה של הטיפול) נמדד בטיפול CBT לחרדה, לדיכאון ולפוסט-טראומה. בנוסף, חשוב לציין כי יש גם יתרון מעשי שחלק מהמטופלים מדווחים עליו: לעיתים ההגעה לקליניקה היא בעצמה מקור לחרדה, בעיקר למי שמתמודד עם עומס רגשי, חרדות קהל ואגורפוביה (חרדה ממקומות הומים). הפגישה מהבית מסירה את המחסום שמונע להתחיל. במקרים של חרדה חברתית או ביישנות יש יתרון נוסף לכך שהמטופל נמצא פיסית במקום הבטוח שלו, והוא בעל מסוגלות גבוהה יותר להיות אקטיבי ומשתתף פעיל בטיפול. עם זאת, חשוב לציין גם חסרונות לטיפול בחרדה מרחוק – חלק חשוב מטיפול בחרדה קשור לחשיפה הדרגתית למצבים אמיתיים. לעיתים דווקא למאמץ להגיע פיסית ולהתמודד עם החרדות הללו (אגורפוביה, ביישנות, חרדת קהל וכו') יש גם ערך חיובי. בשל כך, לעיתים כדאי לחשוב על מודל משולב במידה וניתן – בתחילה עבודה מרחוק ולאחר מכן מעבר לעבודה בקליניקה באופן מלא או חלקי.",
  "טיפול-בדיכאון":
    "טיפול אונליין בדיכאון נחקר רבות: המטא-אנליזה העדכנית ב-World Psychiatry (Hedman-Lagerlöf ועמיתיו, 2023) מצאה שאין הבדל משמעותי בין טיפול מבוסס-אינטרנט בליווי מטפל לבין טיפול פנים אל פנים. טיפול אונליין נמצא יעיל במיוחד ב-CBT לדיכאון (Fernandez ועמיתיו, 2021). חשוב לציין כי במקרים של דיכאון, ובייחוד דיכאון מג'ורי קשה, לפורמט זה ישנו יתרון ייחודי: בימים שבהם לצאת מהבית מרגיש בלתי אפשרי עבור המטופל, הפגישה מתקיימת בכל זאת, במקום שהייתה מתבטלת במקרה של טיפול פנים אל פנים. רצף כזה הוא בדיוק מה שמגן על הטיפול בתקופות הקשות ויכול להוות עוגן רגשי משמעותי עבור המטופל.",
  "פסיכולוג-ילדים":
    "כאן נדרשת כנות: עם ילדים צעירים, טיפול רגשי עובד דרך משחק ונוכחות משותפת בחדר, ולכן פגישות וידאו מתאימות פחות לגיל הרך. גם במקרים של ילדים ההצלחות של טיפול מרחוק אינן גבוהות משום שהחלקים הוורבאליים עדיין אינם מפותחים דיים ויש הרבה צורך בקרבה, אינטימיות פנים אל פנים ומשחקיות, אלמנטים שבלתי אפשרי או קשה מאוד לעשות בטיפול אונליין. עם זאת, הדרכת הורים, או טיפול בילד דרך ההורים הינה בעלת איכויות רבות והצלחות טיפוליות משמעותיות גם בטיפול מרחוק. יתירה מזאת, הורים רבים מוצאים הדרכה מרחוק כיעילה ביותר, קשה מאוד להם לסנכרן לו\"ז ולמצוא בייביסיטר בשעות הטיפול, שהן לרוב בשעות הערב או בשעות העבודה, ולכן טיפול מרחוק מהבית שלהם יכול להפוך את הטיפול ליישים. לעיתים הקושי הטכני של להגיע פיסית לטיפול ולתאם עם המטפל גם גורם לטיפולים להפסיק לפני שהם מיצו את הצורך.",
  "פסיכולוג-לנוער":
    "מתבגרים הם לעיתים קרובות דווקא הקהל שהכי טבעי לו המסך: השיחה מהחדר שלהם, במרחב שבשליטתם, יכולה להרגיש בטוחה יותר מקליניקה זרה - ולחלקם קל יותר להיפתח כך. התנאי הקריטי הוא פרטיות אמיתית בבית: דלת שנסגרת, שעה שבה אף אחד לא מקשיב. כשאין פינה כזו, או כשהמתבגר/ת זקוקים לעוגן פיזי יציב מחוץ לבית, הקליניקה עדיפה. גם כאן העבודה עם ההורים נמשכת במינון מותאם לגיל.",
  CBT: "מכל הגישות, ל-CBT יש את גוף הראיות הגדול ביותר לטיפול מרחוק: המטא-אנליזות המרכזיות שהשוו טיפול קוגניטיבי-התנהגותי מבוסס-אינטרנט בליווי מטפל לטיפול פנים אל פנים (Carlbring ועמיתיו, 2018; Hedman-Lagerlöf ועמיתיו, 2023, World Psychiatry) מצאו תוצאות שקולות. זה גם הגיוני קלינית: CBT מובנה, ממוקד מטרות ונשען על תרגול בין פגישות - מבנה שעובר מסך בקלות. יומני מחשבות, דירוגי חרדה ומשימות חשיפה מתנהלים היום בקבצים משותפים ובאפליקציות, לעיתים בצורה נוחה יותר מדפים מודפסים.",
  "טיפול-זוגי":
    "טיפול זוגי אונליין מצריך היערכות קטנה אבל פותח אפשרויות שקליניקה לא תמיד מאפשרת: שני בני הזוג יכולים להצטרף מאותו חדר - וזה המצב המומלץ כשאפשר - אך גם ממקומות שונים כשמישהו בנסיעה, במילואים או ברילוקיישן, והטיפול לא נקטע. זוגות עם ילדים קטנים חוסכים את תיאום הבייביסיטר, שלא פעם הוא הסיבה האמיתית לדחיית פגישות. חשוב לתאם מראש עם המטפל/ת את הסטינג: מי יושב איפה, שהמצלמה תקלוט את שניכם, ושהשעה באמת פנויה משיבושים.",
};

function onlineHeading(name: string): string {
  return `${name} אונליין`;
}

async function resolve(params: Promise<{ topic: string }>) {
  const { topic: topicSlug } = await params;
  const topic = slugToCityTopic(topicSlug);
  if (!topic) return null;
  if (!isOnlineTopicAllowed(topic)) return null;
  return { topic };
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: "עמוד לא נמצא" };
  const { topic } = r;
  const title = `${onlineHeading(topic.name)} - מטפלים מאומתים בווידאו`;
  const description = `${onlineHeading(topic.name)}: מטפלים ופסיכולוגים מאומתים שמטפלים בשיחת וידאו, מכל מקום בארץ. השוו, בחרו ופנו ישירות - או קבלו התאמה אישית בחינם.`;
  const url = `${BASE}/therapists/online/${topic.slug}`;
  const count = await countListed({ ...topic.filter, online: true });
  const robots =
    topic.adsOnly || count < MIN_ONLINE_TOPIC ? { index: false as const, follow: true } : undefined;
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}

export default async function OnlineTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { topic } = r;

  const list = await loadPublicTherapists({ ...topic.filter, online: true });
  const heading = onlineHeading(topic.name);
  const note = ONLINE_NOTES[topic.slug];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    inLanguage: "he",
    url: `${BASE}/therapists/online/${topic.slug}`,
    hasPart: list.slice(0, 50).map((t) => ({
      "@type": "Person",
      name: t.full_name,
      jobTitle: t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : undefined,
      url: `${BASE}${therapistPath(t.id, t.full_name)}`,
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "טיפול אונליין", item: `${BASE}/therapists/region/אונליין` },
      { "@type": "ListItem", position: 4, name: topic.name, item: `${BASE}/therapists/online/${topic.slug}` },
    ],
  };

  // Sister online-topic pages, only those indexable themselves.
  const sisters: { slug: string; name: string }[] = [];
  for (const slug of onlineTopicSlugs()) {
    if (slug === topic.slug) continue;
    const t = slugToCityTopic(slug);
    if (!t || t.adsOnly) continue;
    const n = await countListed({ ...t.filter, online: true });
    if (n >= MIN_ONLINE_TOPIC) sisters.push({ slug: t.slug, name: t.name });
  }
  const isNamedTopic = TOPICS.some((t) => t.slug === topic.slug);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`online_topic:${topic.slug}`} source="online_topic" />

      <Link href="/therapists/region/אונליין" className="text-sm text-stone-500 hover:underline mb-6 inline-block">
        ← כל המטפלים אונליין
      </Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          טיפול מרחוק לפי נושא
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{heading}</h1>
        <p className="mt-2 text-sm text-stone-500">
          {topic.supplyNote}, שמטפלים גם בשיחת וידאו - {list.length} מטפלים, מכל מקום בארץ או בחו"ל.
        </p>
      </div>

      {/* Quiz CTA */}
      <div
        className="mb-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
      >
        <div>
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--teal-dark)" }}>רוצים התאמה מדויקת יותר?</p>
          <p className="mt-1.5 leading-7 text-stone-600" style={{ maxWidth: "48ch" }}>
            ענו על שאלון קצר מבוסס מחקר - נזהה את הצורך, נמליץ על סוג הטיפול, ונתאים לכם מטפל/ת אונליין.
            בחינם, אנונימי וללא התחייבות.
          </p>
        </div>
        <Link
          href="/adults"
          className="shrink-0 inline-flex items-center justify-center whitespace-nowrap font-bold transition hover:opacity-95"
          style={{ background: "var(--teal)", color: "#fff", borderRadius: "50px", padding: "13px 30px", fontSize: "15px" }}
        >
          למילוי השאלון
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          כרגע אין מטפלים מוצגים בשילוב הזה. אפשר לראות את{" "}
          <Link href="/therapists/region/אונליין" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים אונליין</Link>{" "}
          או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistResultCard key={t.id} t={t} backHref={`/therapists/online/${topic.slug}`} />
          ))}
        </div>
      )}

      {/* Prose below the listings: the topic's own intro + what online delivery
          means for THIS topic - the content that separates the page from its
          parent listing. */}
      {topic.intro && (
        <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
            על {topic.name} - מה חשוב לדעת
          </h2>
          <p className="text-[15px] leading-8 text-stone-600">{topic.intro}</p>
        </section>
      )}

      {note && (
        <section className="mt-8" style={{ maxWidth: "72ch" }}>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
            {topic.name} מרחוק - מה כדאי לדעת
          </h2>
          <p className="text-[15px] leading-8 text-stone-600">{note}</p>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            למחקרים המלאים על יעילות הטיפול מרחוק:{" "}
            <Link href="/research/online-therapy" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
              טיפול פסיכולוגי אונליין - האם זה עובד ולמי מתאים?
            </Link>
          </p>
        </section>
      )}

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">המשך עיון</h2>
        <div className="flex flex-wrap gap-2">
          {isNamedTopic && (
            <Link
              href={`/therapists/topic/${topic.slug}`}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              {topic.name} - בכל הארץ
            </Link>
          )}
          <Link
            href="/therapists/region/אונליין"
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
          >
            🌐 כל המטפלים אונליין
          </Link>
          {sisters.map((s) => (
            <Link
              key={s.slug}
              href={`/therapists/online/${s.slug}`}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              {s.name} אונליין
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
