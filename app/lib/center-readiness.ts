import "server-only";
import type { CenterDirector, CenterFaqItem, CenterGalleryPhoto, CenterTeamMember } from "./center-public";

// מוכנות מרכז - לפי המסלול שנרכש, ולא לפי מדד אחד לכולם.
//
// למה זה קיים: ב-16/8/26 נשלח ל"ציידי המחשבות" מייל "הפרופיל שלכם מלא ב-0%".
// הם משלמים במסלול per_therapist, שבו המוצר הוא המטפלים שלהם במערכת
// ההתאמות - והעמוד הציבורי הוא תוספת. כלומר נמדדו במדד הלא נכון, וקיבלו
// מייל שמדבר על הדבר הפחות חשוב אצלם. במקביל הדבר שכן היה חשוב - עשרה
// מקומות במרכז שאף אחד מהם לא אויש - לא נאמר במילה.
//
// שני מסלולים, שני מוצרים שונים:
//   per_therapist  - מטפלי המרכז נכנסים להתאמות, כל אחד בפרופיל משלו.
//                    המדד: כמה מהמקומות במרכז מאוישים ומקודמים בפועל.
//   center_entity  - המרכז נכנס להתאמות כרובריקה אחת. המדד: האם הרובריקה
//                    מוגדרת (סוגי טיפול/אזורים/גילאים) והאם העמוד הציבורי
//                    חי - כאן העמוד הוא המוצר עצמו, לא תוספת.
//
// owner על כל פריט: 'center' = הם צריכים לפעול, 'us' = אנחנו חייבים להם.
// אסור לשלוח נדנוד שהחסם שלו אצלנו - זו הדרך המהירה ביותר לאבד אמון.

export type ReadinessOwner = "center" | "us";

export type ReadinessItem = {
  label: string;
  done: boolean;
  owner: ReadinessOwner;
  // critical = בלי זה המרכז לא מקבל את מה שהמנוי אמור לתת לו.
  critical: boolean;
  hint?: string;
};

export type CenterReadiness = {
  track: "per_therapist" | "center_entity";
  trackLabel: string;
  pct: number;
  items: ReadinessItem[];
  /** מה שחסר ובאחריותם - זה מה שנכנס למייל. */
  missingForCenter: ReadinessItem[];
  /** מה שחסר ובאחריותנו - זה נשאר פנימי ולא נשלח לאף אחד. */
  blockedOnUs: ReadinessItem[];
  /** הכותרת העסקית: מה הכי חשוב שיקרה אצלם עכשיו. */
  headline: string | null;
  /** מקומות במרכז מול מאוישים - רק במסלול per_therapist. */
  slots: { paid: number; filled: number; promoted: number } | null;
};

export type CenterRowForReadiness = {
  billing_track: string | null;
  therapist_count: number | null;
  public_page_enabled: boolean | null;
  logo_path: string | null;
  public_description: string | null;
  team_members: unknown;
  gallery: unknown;
  public_director: unknown;
  public_founded_year: number | null;
  public_team_size: number | null;
  public_address: string | null;
  public_hours: string | null;
  public_faq: unknown;
};

/** מצב מטפלי המרכז, כפי שנשלף פעם אחת בקורא. */
export type CenterTherapistStats = {
  linked: number;
  promoted: number;
  awaitingOurApproval: number;
  incompleteProfiles: number;
  openInvites: number;
};

/** הרובריקה של מסלול 2 במערכת ההתאמות (שורת entity_type='center'). */
export type CenterEntityRow = {
  therapist_types: unknown;
  training_areas: unknown;
  regions: unknown;
  age_groups: unknown;
  languages: unknown;
  bio: string | null;
} | null;

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function publicPageItems(c: CenterRowForReadiness, criticalAll: boolean): ReadinessItem[] {
  const team = Array.isArray(c.team_members) ? (c.team_members as CenterTeamMember[]) : [];
  const gallery = Array.isArray(c.gallery) ? (c.gallery as CenterGalleryPhoto[]) : [];
  const faq = Array.isArray(c.public_faq) ? (c.public_faq as CenterFaqItem[]) : [];
  const director =
    c.public_director && typeof c.public_director === "object" && !Array.isArray(c.public_director)
      ? (c.public_director as CenterDirector)
      : {};

  const item = (label: string, done: boolean, critical: boolean, hint?: string): ReadinessItem => ({
    label,
    done,
    owner: "center",
    critical: criticalAll && critical,
    hint,
  });

  return [
    item("לוגו המרכז", !!c.logo_path, true),
    item("תיאור המרכז", (c.public_description ?? "").trim().length >= 40, true),
    item("2+ תמונות של המרכז", gallery.length >= 2, false),
    item("איש/אשת צוות אחד לפחות", team.some((m) => (m.name ?? "").trim().length > 0), false),
    item(
      'דבר המנהל/ת ("אני מאמין")',
      !!((director.name ?? "").trim() && (director.note ?? "").trim()),
      false
    ),
    item("כתובת", (c.public_address ?? "").trim().length > 0, true),
    item("שעות פעילות", (c.public_hours ?? "").trim().length > 0, false),
    item("שנת ייסוד", c.public_founded_year != null, false),
    item("גודל הצוות", c.public_team_size != null, false),
    item("שאלה נפוצה אחת לפחות", faq.some((f) => (f.q ?? "").trim() && (f.a ?? "").trim()), false),
  ];
}

export function centerReadiness(
  c: CenterRowForReadiness,
  stats: CenterTherapistStats,
  entity: CenterEntityRow
): CenterReadiness {
  const isEntity = c.billing_track === "center_entity";
  const items: ReadinessItem[] = [];
  let headline: string | null = null;
  let slots: CenterReadiness["slots"] = null;

  if (isEntity) {
    // מסלול 2: הרובריקה בהתאמות היא המוצר. בלי סוגי טיפול המרכז פשוט לא
    // קיים בשום שאלון, וזה קודם לכל דבר אחר בעמוד.
    const hasTypes = arrLen(entity?.therapist_types) > 0 || arrLen(entity?.training_areas) > 0;
    const hasRegions = arrLen(entity?.regions) > 0;
    const hasAges = arrLen(entity?.age_groups) > 0;
    const hasLangs = arrLen(entity?.languages) > 0;
    const hasBio = (entity?.bio ?? "").trim().length >= 40;

    items.push(
      { label: "סוגי הטיפול שהמרכז נותן", done: hasTypes, owner: "center", critical: true,
        hint: "בלי זה המרכז לא מופיע באף שאלון" },
      { label: "אזורי הפעילות", done: hasRegions, owner: "center", critical: true },
      { label: "גילאים שהמרכז מקבל", done: hasAges, owner: "center", critical: true },
      { label: "שפות", done: hasLangs, owner: "center", critical: false },
      { label: "תיאור המרכז בהתאמות", done: hasBio, owner: "center", critical: true }
    );
    // במסלול 2 העמוד הציבורי חי אוטומטית, ולכן התוכן שלו קריטי.
    items.push(...publicPageItems(c, true));

    if (!hasTypes || !hasRegions || !hasAges) {
      headline = "המרכז עדיין לא מופיע בהתאמות - חסרות ההגדרות הבסיסיות";
    }
  } else {
    // מסלול 1: המוצר הוא המקומות, ולכן הם נמדדים ראשונים. לשון התשלום
    // הוצאה מכל התוויות (החלטת המשתמש 20/8) - הן נקראות גם במייל למרכז,
    // וזה מייל שירות ולא תזכורת גבייה.
    const paid = Math.max(0, Number(c.therapist_count) || 0);
    slots = { paid, filled: stats.linked, promoted: stats.promoted };

    const anyPromoted = stats.promoted > 0;
    const slotsFree = Math.max(0, paid - stats.linked);

    // רמז כן: אם מטפל שכבר מילא ממתין לאישור שלנו, אומרים את זה במפורש -
    // אחרת המרכז מקבל "אף אחד לא פעיל" ומרגיש מואשם במשהו שתקוע אצלנו.
    const ourQueueHint =
      stats.awaitingOurApproval > 0
        ? `${stats.awaitingOurApproval} שכבר מילאו ממתינים לאישור שלנו - נטפל בזה`
        : undefined;
    const slotHint = slotsFree > 0 ? `${slotsFree} מקומות עדיין פנויים` : undefined;
    items.push({
      label:
        paid > 0
          ? `איוש המקומות במרכז (${stats.promoted} מתוך ${paid} פעילים בהתאמות)`
          : "מטפלים פעילים בהתאמות",
      done: paid > 0 ? stats.promoted >= paid : anyPromoted,
      owner: "center",
      critical: true,
      hint: [slotHint, ourQueueHint].filter(Boolean).join(" · ") || undefined,
    });

    if (stats.openInvites > 0) {
      items.push({
        label: `${stats.openInvites} הזמנות שנשלחו ולא מולאו`,
        done: false,
        owner: "center",
        critical: false,
        hint: "אפשר לשלוח תזכורת מהפורטל",
      });
    }
    if (stats.incompleteProfiles > 0) {
      items.push({
        label: `${stats.incompleteProfiles} פרופילים של מטפלי המרכז חסרים פרטים`,
        done: false,
        owner: "center",
        critical: true,
        hint: "פרופיל חסר לא עובר אישור ולא נכנס להתאמות",
      });
    }
    // חסם שאצלנו - נספר במדד אבל לעולם לא נשלח אליהם.
    if (stats.awaitingOurApproval > 0) {
      items.push({
        label: `${stats.awaitingOurApproval} מטפלים ממתינים לאישור שלנו`,
        done: false,
        owner: "us",
        critical: true,
      });
    }
    // במסלול 1 העמוד הציבורי הוא תוספת, ורק אם הופעל.
    if (c.public_page_enabled) {
      items.push(...publicPageItems(c, false));
    }

    // הכותרת מתארת תמיד את מה שבידיים שלהם. כשהעיכוב היחיד הוא תור האישורים
    // שלנו - אין כותרת בכלל, ולא נשלח נדנוד שמאשים אותם בהמתנה שלנו.
    if (stats.linked === 0) {
      headline =
        paid > 0
          ? `אף מטפל/ת מהמרכז לא מקושר/ת עדיין - ${paid} מקומות פנויים`
          : "אף מטפל/ת מהמרכז לא מקושר/ת עדיין";
    } else if (slotsFree > 0) {
      headline = `${slotsFree} מתוך ${paid} המקומות במרכז עדיין פנויים`;
    } else if (!anyPromoted && stats.awaitingOurApproval === 0) {
      headline = "אף מטפל/ת מהמרכז לא פעיל/ה עדיין בהתאמות";
    }
  }

  const missingForCenter = items.filter((i) => !i.done && i.owner === "center");
  const blockedOnUs = items.filter((i) => !i.done && i.owner === "us");
  const done = items.filter((i) => i.done).length;
  const pct = items.length === 0 ? 100 : Math.round((done / items.length) * 100);

  return {
    track: isEntity ? "center_entity" : "per_therapist",
    trackLabel: isEntity ? "מרכז כישות אחת" : "מסלול לפי מטפלים",
    pct,
    items,
    missingForCenter,
    blockedOnUs,
    headline,
    slots,
  };
}
