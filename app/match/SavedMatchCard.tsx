import MatchCardWhatsApp from "@/app/components/MatchCardWhatsApp";
import MatchResultCard, { MATCH_CARD_BTN, MatchCardProfileLink } from "@/app/components/MatchResultCard";
import CenterMessageButton from "@/app/centers/[slug]/CenterMessageButton";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";
import { publicTherapistTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { bioSnippet } from "@/app/lib/bio-snippet";
import { professionalFitLabel, outOfAreaReason } from "@/app/lib/match-card-label";
import type { SavedScore } from "@/app/lib/saved-match-scores";

// כרטיס ברשימת התאמות שמורה (/match/<token>): אותו MatchResultCard של מסך
// התוצאות בשני השאלונים, כדי שמי שחוזר לרשימה ששמר יראה את מה שראה אז: אחוז
// התאמה, באזור או מחוץ לו, ווואטסאפ כפעולה הראשית. כאן נקבע רק מה שמיוחד
// לרשימה השמורה: הנתונים מהטוקן, הקישור לפרופיל, ומטפל שכבר לא מקבל פניות.
//
// מה שחסר כאן בכוונה: "למה הותאמ/ה לי?". ההסבר נבנה מממצאי השאלון, והרשימה
// השמורה לא שומרת ממצאים (ראו 20260918_match_token_scores.sql). גם תג הגישה
// הזוגית חסר, כי הוא נגזר מהעדפת המטופל.

export default function SavedMatchCard({
  t,
  score,
  away,
  locationAsked,
  onlineRequested,
  token,
  quizType,
  treatmentLabel,
}: {
  t: PublicTherapist;
  /** null בטוקן ישן, שנשמר לפני שהציונים נשמרו - אז אין תיבת אחוז. */
  score: SavedScore | null;
  away: boolean;
  locationAsked: boolean;
  onlineRequested: boolean;
  token: string;
  quizType: "adults" | "kids";
  treatmentLabel: string | null;
}) {
  const isCenter = t.is_center === true;
  const kids = quizType === "kids";
  const overall = score ? score.combined_score ?? score.match_score : null;
  const accepting = t.accepting_new_patients !== false;
  const title = isCenter ? "מרכז טיפולי" : t.therapist_types[0] ? publicTherapistTitle(t.therapist_types[0], t.gender, t.age_groups) : t.gender;
  const snippet = bioSnippet(t.bio);

  // אותם פרמטרים שהכרטיס בתוצאות שולח, מתוך מה שנשמר: from=match כדי שהצפייה
  // והפנייה ייספרו כהתאמה, ret כדי ש"חזרה" בפרופיל תחזור לכאן, והציון ותווית
  // הטיפול ל"מה הוביל אותם אליך" אצל המטפל. בשאלון הילדים הנושא וקבוצת הגיל
  // קבועים ("child").
  const profileHref = (() => {
    if (isCenter) return t.center_slug ? `/centers/${t.center_slug}?from=match` : null;
    const params = new URLSearchParams({ from: "match" });
    if (overall != null) params.set("s", String(overall));
    // `a` stays: the profile reads it to send "back" to /kids. The domain and
    // the treatment go through sessionStorage on click, never the URL - see
    // app/lib/match-view-context.ts.
    if (kids) params.set("a", "child");
    params.set("ret", `/match/${token}`);
    return `${therapistPath(t.id, t.full_name)}?${params.toString()}`;
  })();

  return (
    <MatchResultCard
      name={t.full_name || "ללא שם"}
      nameAs="h2"
      isCenter={isCenter}
      photoUrl={t.profile_photo_url}
      gender={t.gender}
      subtitle={`${title}${title ? " • " : ""}${t.online ? "אונליין" : "פנים אל פנים"}`}
      affiliation={!isCenter && t.center_name ? `מצוות ${t.center_name}` : null}
      bio={snippet}
      regions={t.regions}
      inAreaChip={locationAsked && !away && score?.in_requested_area ? `✓ באזור ${kids ? "שלכם" : "שלך"}` : null}
      score={
        !score
          ? null
          : away
            // מחוץ לאזור: מילים במקום אחוז (ראו app/lib/match-card-label.ts).
            ? { kind: "words", label: professionalFitLabel(score.match_score), reason: outOfAreaReason(onlineRequested, t.online) }
            : overall != null
              ? { kind: "percent", overall, professional: score.match_score, personality: score.personality_score }
              : null
      }
      centerNote={
        isCenter && score?.personality_score != null && !away
          ? `* במרכז פועל מספר רב של מטפלים - צוות המרכז יתאים ${kids ? "לכם" : "לך"} מתוכו את המטפל/ת המתאים/ה גם אישיותית.`
          : null
      }
      notice={
        !accepting && (
          <p className="mt-3 text-[13px] font-semibold text-[var(--muted)]">
            ⏸ {t.gender === "נקבה" ? "לא זמינה כרגע למטופלים חדשים" : "לא זמין כרגע למטופלים חדשים"}
          </p>
        )
      }
      actions={
        <>
          {/* אותה היררכיה כמו בתוצאות: וואטסאפ ראשון ומלא, הפרופיל אחריו. */}
          {accepting && isCenter && t.center_whatsapp && (
            <MatchCardWhatsApp therapistId={t.id} phone={t.center_whatsapp} centerMode />
          )}
          {accepting && isCenter && t.trackable !== false && (
            <CenterMessageButton
              entityId={t.id}
              centerName={t.full_name ?? "המרכז"}
              source="match"
              label="שליחת הודעה למרכז"
              className={MATCH_CARD_BTN.centerMessage}
            />
          )}
          {accepting && !isCenter && <MatchCardWhatsApp therapistId={t.id} phone={t.phone} />}
          {profileHref && (
            <MatchCardProfileLink
              href={profileHref}
              therapistId={t.id}
              context={isCenter ? undefined : { issue: kids ? "child" : undefined, treatment: treatmentLabel ? treatmentLabel.slice(0, 80) : undefined }}
            />
          )}
        </>
      }
    />
  );
}
