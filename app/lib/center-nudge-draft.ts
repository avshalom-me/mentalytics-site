import "server-only";
import type { CenterReadiness } from "./center-readiness";

// ניסוח הטיוטה שהסוכן מכין למרכז - טקסט רגיל, בדיוק כמו טיוטת הצעת המתנה
// למטפלים: הסוכן מנסח, אתה קורא ומתקן, ואתה שולח.
//
// שלושה כללים שהמשתמש קבע (20/8/26):
//   1. אין סכומי כסף בטקסט. בכלל.
//   2. אין "שילמתם" ואין רמז לתשלום. מדברים על מה שיש ומה שחסר, לא על
//      מה שנקנה - זה מייל שירות, לא תזכורת גבייה.
//   3. פריט שהחסם שלו אצלנו מוצג ככזה, בגוף ראשון ("אנחנו נטפל בזה"),
//      ולא כמשימה שלהם.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

export type CenterDraft = { subject: string; body: string };

export function buildCenterNudgeDraft(opts: {
  centerName: string;
  readiness: CenterReadiness;
  token: string | null;
  hasAccount: boolean;
}): CenterDraft {
  const { readiness: r } = opts;
  const name = (opts.centerName || "המרכז").trim();
  const isEntity = r.track === "center_entity";

  const url = !opts.hasAccount && opts.token
    ? `${SITE_URL}/centers/join/${opts.token}`
    : isEntity
      ? `${SITE_URL}/centers/dashboard/profile`
      : `${SITE_URL}/centers/dashboard/therapists`;

  const lines: string[] = [`שלום ${name},`, ``];

  if (isEntity) {
    lines.push(
      "המרכז מופיע במערכת ההתאמות כרובריקה אחת, ומטופלים מתאימים מופנים אליכם לפי מה שסימנתם. ככל שההגדרות והעמוד הציבורי מלאים יותר, כך המרכז נתפס ביותר שאלונים ומגיעות אליו יותר פניות."
    );
  } else {
    lines.push(
      "מטפלי המרכז נכנסים למערכת ההתאמות, וכל מטפל/ת שמקושר/ת ומאושר/ת מתחיל/ה לקבל פניות ממטופלים שמחפשים בדיוק את מה שהוא/היא נותן/ת."
    );
  }
  lines.push(``);

  const bullets: string[] = [];

  if (!isEntity) {
    // מסלול 1: המצב נאמר פעם אחת במשפט, והתבליטים הם פעולות - לא חזרה על
    // אותו מספר בניסוח אחר.
    const slots = r.slots;
    const promoted = slots?.promoted ?? 0;
    const paid = slots?.paid ?? 0;
    const linked = slots?.filled ?? 0;
    const free = Math.max(0, paid - linked);

    if (linked === 0) {
      lines.push(
        paid > 0
          ? `נכון להיום אף מטפל/ת מהמרכז לא מקושר/ת עדיין, וכל ${paid} המקומות של המרכז פנויים.`
          : `נכון להיום אף מטפל/ת מהמרכז לא מקושר/ת עדיין.`
      );
    } else if (free > 0) {
      const active =
        promoted === 0
          ? "אף מטפל/ת עדיין לא פעיל/ה בהתאמות"
          : promoted === 1
            ? "מטפל/ת אחד/ת פעיל/ה בהתאמות"
            : `${promoted} מטפלים פעילים בהתאמות`;
      lines.push(`נכון להיום ${active}, מתוך ${paid} המקומות של המרכז - ${free} מהם עדיין פנויים.`);
    }
    lines.push(``);

    // הפעולה המרכזית: להזמין מטפלים. מנוסחת כהוראה ולא כמדד.
    if (free > 0) {
      bullets.push(
        "להזמין מטפלים מהמרכז דרך פורטל הניהול - כל אחד/ת מקבל/ת הזמנה במייל וממלא/ת את הפרופיל בעצמו/ה."
      );
    }
    for (const i of r.missingForCenter) {
      if (i.label.startsWith("איוש המקומות") || i.label.startsWith("מטפלים פעילים")) continue;
      bullets.push(i.hint ? `${i.label} - ${i.hint}` : i.label);
    }
  } else {
    if (r.headline) {
      lines.push(`${r.headline}.`);
      lines.push(``);
    }
    for (const i of r.missingForCenter) {
      bullets.push(i.hint ? `${i.label} - ${i.hint}` : i.label);
    }
  }

  if (bullets.length > 0) {
    lines.push(bullets.length === 1 ? "מה שנשאר:" : "מה שנשאר לעשות:");
    for (const b of bullets) lines.push(`• ${b}`);
    lines.push(``);
  }

  // מה שתקוע אצלנו נאמר בגוף ראשון, כדי שלא ייראה כמו משימה שלהם.
  if (r.blockedOnUs.length > 0) {
    const n = r.blockedOnUs.length === 1 ? "מטפל/ת אחד/ת" : `${r.blockedOnUs.length} מטפלים`;
    lines.push(
      `בנוסף, ${n} מהמרכז כבר מילא/ו פרופיל וממתין/ים לאישור שלנו - זה אצלנו, ואנחנו מטפלים בזה.`
    );
    lines.push(``);
  }

  lines.push(isEntity ? "הקישור לעריכת פרופיל המרכז:" : "הקישור לניהול מטפלי המרכז:");
  lines.push(url);
  lines.push(``);
  lines.push("רוצים שנעשה את זה יחד? השיבו למייל הזה ונתאם שיחה קצרה - נשמח גם למלא עבורכם.");
  lines.push(``);
  lines.push("בברכה,");
  lines.push("צוות טיפול חכם");

  // הנושא מתאר את המצב, בלי מספרים של כסף ובלי אחוזים.
  const subject = isEntity
    ? `${name} - כמה פרטים שיעזרו למרכז להיתפס ביותר התאמות`
    : r.slots && r.slots.filled === 0
      ? `${name} - אף מטפל/ת עדיין לא מקושר/ת למרכז`
      : `${name} - נשארו מקומות פנויים במרכז`;

  return { subject, body: lines.join("\n") };
}
