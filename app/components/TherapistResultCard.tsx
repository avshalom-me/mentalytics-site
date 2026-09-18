import Link from "next/link";
import { publicTherapistTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { CITY_TO_REGION } from "@/app/lib/regions";
import CardImpression from "@/app/components/CardImpression";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";
import { bioSnippet } from "@/app/lib/bio-snippet";
import CenterMessageButton from "@/app/centers/[slug]/CenterMessageButton";
import CenterWhatsAppLink from "@/app/centers/[slug]/CenterWhatsAppLink";
import { waLinkForCenter } from "@/app/lib/phone";

// Context-aware ordering for the card's city chip: on a city landing page the
// page's own city shows first (a Kfar-Saba visitor seeing "📍 נתניה" on a
// Kfar-Saba page read as a bug - regions[0] was just whatever city the
// therapist typed first), then other cities in the page's region, then the
// rest. All cities are shown (therapists list at most ~3), like the matching
// results already do.
function orderRegions(regions: string[], contextCity?: string, contextRegion?: string): string[] {
  if (regions.length < 2) return regions;
  const score = (c: string) =>
    c === contextCity ? 0 : contextRegion && (CITY_TO_REGION[c] === contextRegion || c === contextRegion) ? 1 : 2;
  return [...regions].sort((a, b) => score(a) - score(b));
}

// Server-rendered therapist card for the region / city SEO landing pages
// (links to the profile; contact clicks track on the profile). Wrapped in a
// client impression tracker so cards shown here count as "חשיפות" like the
// main directory's.
export default function TherapistResultCard({
  t,
  backHref,
  contextCity,
  contextRegion,
  fromMatch = false,
}: {
  t: PublicTherapist;
  backHref?: string;
  contextCity?: string;
  contextRegion?: string;
  /**
   * הכרטיס מוצג ברשימת התאמות שמורה (/match/<token>) ולא במאגר. הפרופיל
   * נפתח כהגעה מההתאמה, כך שצפייה ופנייה נספרות כ"התאמה" ולא כ"מאגר"
   * או "פרופיל" - גם באדמין וגם אצל המטפל.
   */
  fromMatch?: boolean;
}) {
  // ישות-מרכז: עמוד המטפל שלה מחזיר 404 במכוון, אין לה מגדר ולרוב אין תמונה.
  const isCenter = t.is_center === true;
  // חינמי מוסתר למבקר ממומן דרך CSS (html.mnt-paid) - ראו app/lib/paid-visitor.ts.
  const tier = t.free ? "free" : "promoted";
  // למרכז אין שורת תואר: שני סוגי המטפלים הראשונים ברשימה ("עו"ס קליני ·
  // מטפל מיני" אצל מרכז רותם, מתוך תשעה) תיארו מוסד כאילו היה אדם עם מקצוע.
  const type = isCenter
    ? ""
    : t.therapist_types[0] ? publicTherapistTitle(t.therapist_types[0], t.gender, t.age_groups) : "";
  const avatar = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const snippet = bioSnippet(t.bio);
  // "ret" lets the profile's back link return to THIS listing page (region /
  // city / online / center) rather than the generic /therapists directory.
  const query = new URLSearchParams();
  if (fromMatch) query.set("from", "match");
  if (backHref && !isCenter) query.set("ret", backHref);
  const qs = query.toString() ? `?${query.toString()}` : "";
  const profileHref = isCenter
    ? (t.center_slug ? `/centers/${t.center_slug}${qs}` : null)
    : `${therapistPath(t.id, t.full_name)}${qs}`;
  const contactSource = fromMatch ? "match" : "directory";
  const cardClass = "group block rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5";
  const cardStyle = { border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.06)", textDecoration: "none" } as const;
  const Body = (
    <>
      <div style={{ height: "260px", overflow: "hidden", background: "var(--surface)", position: "relative" }}>
        {isCenter && !t.profile_photo_url ? (
          // אווטאר מגדרי על ישות עסקית הוא פשוט שגוי - סמל ניטרלי במקומו.
          <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--teal-pale)" }}>
            <span style={{ fontSize: "56px" }} aria-hidden>🏢</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={t.profile_photo_url ?? avatar} alt={t.full_name}
            style={{ width: "100%", height: "100%", objectFit: isCenter ? "contain" : "cover", objectPosition: "center", display: "block", padding: isCenter ? "24px" : 0 }} loading="lazy" />
        )}
        {isCenter && (
          <span className="absolute top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold"
            style={{ insetInlineStart: "12px", color: "var(--teal-dark)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
            🏢 מרכז טיפולי
          </span>
        )}
      </div>
      <div style={{ padding: "16px 18px" }}>
        {/* A listing card is an item, not a section of the page. This was an
            <h2>, which meant the online page told Google it had 118 sections,
            111 of them a person's name - the heading outline is supposed to be
            the page's table of contents, and it was almost entirely noise.
            Rendered appearance is unchanged: size and weight come from the
            classes, not from the tag. */}
        <p className="text-lg font-black text-stone-900 leading-tight group-hover:underline">{t.full_name}</p>
        {type && <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>{type}</div>}
        {/* שיוך למרכז - טקסט בלבד ולא קישור: הכרטיס כולו עטוף ב-Link, ועוגן
            בתוך עוגן אינו HTML תקין. הקישור לעמוד המרכז מופיע בפרופיל עצמו. */}
        {!isCenter && t.center_name && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
            <span aria-hidden>🏢</span> מצוות {t.center_name}
          </div>
        )}
        {snippet && <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-2">{snippet}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.online && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>🌐 אונליין</span>
          )}
          {t.regions.length > 0 && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
              📍 {orderRegions(t.regions, contextCity, contextRegion).join(", ")}
            </span>
          )}
        </div>
      </div>
    </>
  );
  // data-nosnippet: Google may index and rank this text, but may not quote it
  // as the search snippet.
  //
  // Why: on the city pages Google was picking the card grid as the description,
  // producing "פסיכולוגים ומטפלים בבאר שבע · רועי בן שימול · אפרת כהן-נוימן · ..."
  // - a list of names nobody searched for, and on the Haifa page a data dump of
  // titles and towns. Both pages already carry an intro paragraph and a meta
  // description written to earn the click; this stops the grid outbidding them.
  //
  // Ranking is untouched: nosnippet governs display only, the therapist names
  // stay indexed, and the CollectionPage/Person JSON-LD on each listing page is
  // unaffected. A therapist's own name query is answered by their profile page,
  // not by a city page's copy of the name.
  // ישות-מרכז אמיתית שמקבלת פניות: כפתור הודעה ישירה בתחתית הכרטיס. הכפתור
  // לא יכול לשבת בתוך ה-Link (כפתור בתוך עוגן אינו HTML תקין, והלחיצה הייתה
  // גם מנווטת), ולכן המסגרת עוברת לעטיפה, והקישור והכפתור יושבים בתוכה זה
  // מעל זה. כרטיס מרכז מסונתז (trackable=false) מזהה "center:..." ואין לו
  // שורה למען אליה - נשאר כרטיס-קישור רגיל.
  const canMessageCenter = isCenter && t.trackable !== false && t.accepting_new_patients !== false;
  // וואטסאפ של המרכז (15/9/26) - גם לכרטיס מסונתז של מסלול 1, שאין לו שורת
  // מטפל אבל יש לו חשבון מרכז שהלחיצה נרשמת עליו.
  const centerWaHref = isCenter && t.accepting_new_patients !== false ? waLinkForCenter(t.center_whatsapp) : null;
  const card = profileHref && (canMessageCenter || centerWaHref) ? (
    <div className="group flex flex-col rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: cardStyle.border, boxShadow: cardStyle.boxShadow }} data-tier={tier}>
      <Link href={profileHref} className="block" style={{ textDecoration: "none" }} data-nosnippet>{Body}</Link>
      <div className="flex flex-wrap gap-2" style={{ padding: "0 18px 16px" }}>
        {centerWaHref && (
          <CenterWhatsAppLink
            entityId={t.trackable !== false ? t.id : undefined}
            centerId={t.center_account_id ?? undefined}
            href={centerWaHref}
            source={contactSource}
            className="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            וואטסאפ
          </CenterWhatsAppLink>
        )}
        {canMessageCenter && (
          <CenterMessageButton
            entityId={t.id}
            centerName={t.full_name}
            source={contactSource}
            label="שליחת הודעה למרכז"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 bg-[var(--teal)]"
          />
        )}
      </div>
    </div>
  ) : profileHref ? (
    <Link href={profileHref} className={cardClass} style={cardStyle} data-nosnippet data-tier={tier}>{Body}</Link>
  ) : (
    // ישות בלי slug: אין יעד תקף, ועדיף כרטיס לא-לחיץ מקישור ל-404.
    <div className={cardClass} style={cardStyle} data-nosnippet data-tier={tier}>{Body}</div>
  );
  // כרטיס מרכז מסלול-1 מסונתז מחשבון המרכז ואין לו שורת מטפל - דיווח חשיפה
  // עליו היה נכשל על ה-FK של analytics_events.
  return t.trackable === false ? card : <CardImpression therapistId={t.id} tier={tier}>{card}</CardImpression>;
}
