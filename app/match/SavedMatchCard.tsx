import MatchCardWhatsApp from "@/app/components/MatchCardWhatsApp";
import CenterMessageButton from "@/app/centers/[slug]/CenterMessageButton";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";
import { publicTherapistTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { bioSnippet } from "@/app/lib/bio-snippet";
import { professionalFitLabel, outOfAreaReason } from "@/app/lib/match-card-label";
import type { SavedScore } from "@/app/lib/saved-match-scores";

// כרטיס ברשימת התאמות שמורה (/match/<token>). בנוי כמו כרטיס מסך התוצאות
// בשני השאלונים, כדי שמי שחוזר לרשימה ששמר יראה את מה שראה אז: אחוז התאמה,
// באזור או מחוץ לו, ווואטסאפ כפעולה הראשית. עד 18/9/26 הרשימה השמורה הציגה
// כרטיסי מאגר, בלי כל אלה.
//
// מה שחסר כאן בכוונה: "למה הותאמ/ה לי?". ההסבר נבנה מממצאי השאלון, והרשימה
// השמורה לא שומרת ממצאים (ראו 20260918_match_token_scores.sql). גם תג הגישה
// הזוגית חסר, כי הוא נגזר מהעדפת המטופל.
//
// שינוי בכרטיס התוצאות באחד השאלונים צריך לעבור גם לכאן.

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
    if (kids) {
      params.set("i", "child");
      params.set("a", "child");
    }
    if (treatmentLabel) params.set("t", treatmentLabel.slice(0, 80));
    params.set("ret", `/match/${token}`);
    return `${therapistPath(t.id, t.full_name)}?${params.toString()}`;
  })();

  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-stretch gap-4">
        {isCenter && !t.profile_photo_url ? (
          // מרכז בלי לוגו - סמל ניטרלי (לא אווטאר מגדרי; gender של ישות ריק)
          <div className="flex h-[78px] w-[78px] flex-shrink-0 items-center justify-center self-start rounded-2xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] text-3xl" aria-hidden>
            🏢
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={t.profile_photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
            alt={t.full_name ?? ""}
            loading="lazy"
            className={`h-[78px] w-[78px] flex-shrink-0 self-start rounded-2xl ${
              isCenter ? "border border-[var(--line)] bg-white object-contain p-1" : "object-cover"
            }`}
          />
        )}
        <div className="min-w-0 flex-1 text-right">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-[var(--text)]">{t.full_name || "ללא שם"}</h2>
            {isCenter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--gold-dark)]">🏢 מרכז טיפולי</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--teal-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--teal-dark)]">✓ מאומת</span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{title}{title ? " • " : ""}{t.online ? "אונליין" : "פנים אל פנים"}</p>
          {!isCenter && t.center_name && (
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]"><span aria-hidden>🏢</span> מצוות {t.center_name}</p>
          )}
          {snippet && <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-2)]">{snippet}</p>}
          {t.regions.length > 0 && (
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              📍 {t.regions.join(", ")}
              {locationAsked && !away && score?.in_requested_area && (
                <span className="ms-1.5 inline-block rounded-full bg-[var(--teal-pale)] px-2 py-0.5 text-[11px] font-bold text-[var(--teal-dark)]">
                  ✓ באזור {kids ? "שלכם" : "שלך"}
                </span>
              )}
            </p>
          )}
        </div>
        {score && away ? (
          // מחוץ לאזור: מילים במקום אחוז (ראו app/lib/match-card-label.ts).
          <div className="flex w-[110px] flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 text-center">
            <div className="text-[12.5px] font-extrabold leading-snug text-[var(--teal-dark)]">{professionalFitLabel(score.match_score)}</div>
            <div className="my-2 h-px w-2/3 bg-[var(--line)]" />
            <div className="text-[11px] font-bold text-[var(--muted)]">{outOfAreaReason(onlineRequested, t.online)}</div>
          </div>
        ) : score && overall != null ? (
          <div className="flex w-[110px] flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--teal-pale)] px-2 py-3 text-center">
            <div className="text-[2.4rem] font-black leading-none tracking-tight text-[var(--teal-dark)]">
              {overall}<span className="align-super text-base font-extrabold">%</span>
            </div>
            <div className="mt-1 text-[10.5px] font-bold text-[var(--teal)]">{score.personality_score != null ? "התאמה כוללת" : "התאמה מקצועית"}</div>
            {score.personality_score != null && score.match_score != null && (
              <>
                <div className="my-2 h-px w-2/3 bg-[var(--teal-mid)]" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] text-[var(--muted)]">מקצועי <b className="font-extrabold text-[var(--teal-dark)]">{score.match_score}%</b></span>
                  <span className="text-[10.5px] text-[var(--muted)]">אישיותי <b className="font-extrabold text-[var(--teal-dark)]">{score.personality_score}%{isCenter && "*"}</b></span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
      {isCenter && score?.personality_score != null && !away && (
        <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
          * במרכז פועל מספר רב של מטפלים - צוות המרכז יתאים {kids ? "לכם" : "לך"} מתוכו את המטפל/ת המתאים/ה גם אישיותית.
        </p>
      )}
      {!accepting && (
        <p className="mt-3 text-[13px] font-semibold text-[var(--muted)]">
          ⏸ {t.gender === "נקבה" ? "לא זמינה כרגע למטופלים חדשים" : "לא זמין כרגע למטופלים חדשים"}
        </p>
      )}
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
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
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 bg-[var(--teal)]"
          />
        )}
        {accepting && !isCenter && <MatchCardWhatsApp therapistId={t.id} phone={t.phone} />}
        {profileHref && (
          <a
            href={profileHref}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-bold transition-colors hover:bg-[var(--teal-pale)]"
            style={{ borderColor: "var(--teal-mid)", color: "var(--teal-dark)" }}
          >
            פרופיל מלא ←
          </a>
        )}
      </div>
    </div>
  );
}
