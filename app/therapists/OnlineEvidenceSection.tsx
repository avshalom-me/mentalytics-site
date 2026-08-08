/**
 * The evidence block at the foot of the online landing page.
 *
 * Why it exists: the page had 3,190 words but 111 of its 118 H2s were
 * therapist names - almost no unique prose, and it sits on page 3-6 for the
 * head phrases. The competitor that owns those phrases (מכון טמיר) runs ~19
 * sections and 4,000-5,000 words. This closes the content gap with the one
 * thing a clinician-run site can do that a marketing page cannot: name the
 * studies, print the confidence intervals, and say plainly where remote
 * therapy is the weaker option.
 *
 * SOURCING RULE - do not relax it. Effect sizes appear here only where the
 * figure was read in the source record itself. Linardon 2025 is cited
 * qualitatively on purpose: its authors and journal were verified, but the
 * published PDF would not yield its numbers to extraction, so no percentages
 * from it are printed. A number nobody checked is worse than a missing one.
 */

const TEAL = "#3D8C8A";
const TEAL_DARK = "#2A6462";
const GOLD = "#D49018";
const LINE = "#DDE9E8";
const MUTED = "#6B807E";

type Study = {
  label: string;
  sub: string;
  g: number;
  lo: number;
  hi: number;
};

/** Both directly comparative meta-analyses, with the CIs as published. */
const STUDIES: Study[] = [
  { label: "Hedman-Lagerlöf ואחרים, 2023", sub: "31 ניסויים · 3,053 משתתפים", g: 0.02, lo: -0.09, hi: 0.14 },
  { label: "Carlbring ואחרים, 2018", sub: "20 מחקרים · 1,418 משתתפים", g: 0.05, lo: -0.09, hi: 0.2 },
];

/** Chart geometry: g from -0.4 to +0.4 mapped across the plot width. */
const W = 720;
const PLOT_X = 250;
const PLOT_W = 400;
const DOMAIN = 0.4;
const xOf = (g: number) => PLOT_X + PLOT_W / 2 + (g / DOMAIN) * (PLOT_W / 2);

function ForestPlot() {
  const rowH = 62;
  const top = 46;
  const H = top + STUDIES.length * rowH + 46;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="גודל האפקט בשתי מטא-אנליזות שהשוו טיפול מרחוק לטיפול פנים אל פנים. בשתיהן רווח הסמך חוצה את האפס, כלומר לא נמצא הבדל מובהק."
      style={{ minWidth: 560, height: "auto" }}
    >
      {/* band of practical equivalence */}
      <rect x={xOf(-0.2)} y={top - 18} width={xOf(0.2) - xOf(-0.2)} height={STUDIES.length * rowH + 6} fill="#EAF4F3" />
      <line x1={xOf(0)} y1={top - 18} x2={xOf(0)} y2={top + STUDIES.length * rowH - 12} stroke={TEAL_DARK} strokeWidth="1.5" strokeDasharray="4 3" />

      {STUDIES.map((s, i) => {
        const y = top + i * rowH;
        return (
          <g key={s.label}>
            <text x={PLOT_X - 18} y={y - 2} textAnchor="end" fontSize="14.5" fontWeight="700" fill="#131F1E">
              {s.label}
            </text>
            <text x={PLOT_X - 18} y={y + 16} textAnchor="end" fontSize="12" fill={MUTED}>
              {s.sub}
            </text>
            {/* confidence interval */}
            <line x1={xOf(s.lo)} y1={y + 4} x2={xOf(s.hi)} y2={y + 4} stroke={TEAL} strokeWidth="3" />
            <line x1={xOf(s.lo)} y1={y - 4} x2={xOf(s.lo)} y2={y + 12} stroke={TEAL} strokeWidth="3" />
            <line x1={xOf(s.hi)} y1={y - 4} x2={xOf(s.hi)} y2={y + 12} stroke={TEAL} strokeWidth="3" />
            <circle cx={xOf(s.g)} cy={y + 4} r="6.5" fill={TEAL_DARK} />
            <text x={xOf(s.hi) + 12} y={y + 9} fontSize="12.5" fontWeight="700" fill={TEAL_DARK}>
              g={s.g.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* axis */}
      <line x1={PLOT_X} y1={top + STUDIES.length * rowH - 12} x2={PLOT_X + PLOT_W} y2={top + STUDIES.length * rowH - 12} stroke={LINE} strokeWidth="1.5" />
      {[-0.4, -0.2, 0, 0.2, 0.4].map((t) => (
        <g key={t}>
          <text x={xOf(t)} y={top + STUDIES.length * rowH + 8} textAnchor="middle" fontSize="11.5" fill={MUTED}>
            {t > 0 ? `+${t}` : t}
          </text>
        </g>
      ))}
      <text x={xOf(-0.3)} y={top + STUDIES.length * rowH + 30} textAnchor="middle" fontSize="12" fill={MUTED}>
        ← יתרון לפנים אל פנים
      </text>
      <text x={xOf(0.3)} y={top + STUDIES.length * rowH + 30} textAnchor="middle" fontSize="12" fill={MUTED}>
        יתרון לאונליין →
      </text>
      <text x={xOf(0)} y={top - 26} textAnchor="middle" fontSize="12" fontWeight="700" fill={TEAL_DARK}>
        אזור השקילות
      </text>
    </svg>
  );
}

type Fit = { label: string; level: 3 | 2 | 1; note: string };

/**
 * Suitability is a clinical judgement, not a measurement, and the caption says
 * so. Ordering follows where the comparative evidence is strongest (structured
 * therapies for anxiety/depression/PTSD) down to where the format itself gets
 * in the way (play therapy, acute risk).
 */
const FIT: Fit[] = [
  { label: "CBT לחרדה, דיכאון ופוסט-טראומה", level: 3, note: "כאן גוף הראיות ההשוואתי הגדול ביותר" },
  { label: "הדרכת הורים", level: 3, note: "עובד היטב, וחוסך את הסידור לילדים" },
  { label: "טיפול דינמי למבוגרים", level: 2, note: "פחות מחקר השוואתי ישיר, ניסיון קליני חיובי" },
  { label: "טיפול זוגי", level: 2, note: "דורש תיאום סטינג, מאפשר השתתפות ממקומות שונים" },
  { label: "מתבגרים", level: 2, note: "מותנה בפרטיות אמיתית בבית" },
  { label: "ילדים בגיל הרך", level: 1, note: "המשחק והנוכחות בחדר הם חלק מהטיפול" },
  { label: "מצבי סיכון אקוטיים", level: 1, note: "דורש הערכה ישירה ורצף צמוד" },
];

function FitChart() {
  const rowH = 44;
  const H = FIT.length * rowH + 26;
  const barX = 300;
  const barW = 330;
  const color = (l: number) => (l === 3 ? TEAL : l === 2 ? "#8FBFBE" : GOLD);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="מידת ההתאמה של טיפול מרחוק לפי סוג טיפול ואוכלוסייה, משלוש דרגות: מתאים מאוד, מתאים בתנאים, ומתאים פחות."
      style={{ minWidth: 560, height: "auto" }}
    >
      {FIT.map((f, i) => {
        const y = 20 + i * rowH;
        return (
          <g key={f.label}>
            <text x={barX - 16} y={y + 5} textAnchor="end" fontSize="14" fontWeight="600" fill="#131F1E">
              {f.label}
            </text>
            <rect x={barX} y={y - 8} width={barW} height="16" rx="8" fill="#F2F6F6" />
            <rect x={barX} y={y - 8} width={(barW / 3) * f.level} height="16" rx="8" fill={color(f.level)} />
            <text x={barX + 6} y={y + 25} fontSize="11.5" fill={MUTED}>
              {f.note}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const h2 = {
  fontSize: "20px",
  fontWeight: 800,
  color: "#131F1E",
  marginBottom: "12px",
  borderBottom: `2px solid #C2DFDE`,
  paddingBottom: "8px",
} as const;

const p = { fontSize: "15px", lineHeight: 1.85, color: "#3E5250", marginBottom: "14px" } as const;

export default function OnlineEvidenceSection() {
  return (
    <section className="mt-16 pt-12" style={{ borderTop: `1px solid ${LINE}` }}>
      <div style={{ maxWidth: "75ch" }}>
        <h2 style={{ ...h2, fontSize: "24px" }}>טיפול פסיכולוגי אונליין - מה באמת ידוע</h2>
        <p style={p}>
          השאלה אם טיפול נפשי מרחוק עובד כמו טיפול בקליניקה היא מהנחקרות ביותר בפסיכותרפיה של
          העשור האחרון, והתשובה עקבית באופן יוצא דופן. להלן מה שהמחקר מראה, איפה הוא חזק ואיפה
          הוא דל, ומתי דווקא עדיף להגיע לחדר.
        </p>

        <h2 style={h2}>היעילות: מה מראות המטא-אנליזות</h2>
        <p style={p}>
          שתי מטא-אנליזות גדולות השוו ישירות טיפול קוגניטיבי-התנהגותי מבוסס-אינטרנט בליווי מטפל
          לטיפול פנים אל פנים. בשתיהן ההבדל אפסי, ורווח הסמך חוצה את האפס - כלומר לא נמצא הבדל
          מובהק לטובת אף אחד מהפורמטים.
        </p>
      </div>

      <figure style={{ margin: "20px 0 8px" }}>
        <div
          className="rounded-2xl"
          style={{
            background: "#F7FAF9",
            border: `1px solid ${LINE}`,
            padding: "18px 14px",
            // Below ~590px the chart would otherwise scale down to ~42% and
            // render its 14px labels at 6px. Scrolling keeps them readable.
            overflowX: "auto",
          }}
        >
          <ForestPlot />
        </div>
        <figcaption style={{ fontSize: "12.5px", color: MUTED, marginTop: "10px", lineHeight: 1.7, maxWidth: "75ch" }}>
          g הוא גודל אפקט: 0 פירושו אין הבדל. הקו האופקי הוא רווח הסמך של 95%. בשתי המטא-אנליזות
          הרווח חוצה את האפס, וזו הנקודה - <strong>לא נמצא הבדל מובהק</strong> בין הפורמטים. מקורות
          מלאים בתחתית העמוד.
        </figcaption>
      </figure>

      <div style={{ maxWidth: "75ch" }}>
        <p style={p}>
          מטא-אנליזה נוספת בדקה דווקא טיפול בשיחת וידאו, כפי שרוב המטופלים פוגשים אותו, ומצאה
          שההבדל מטיפול בקליניקה זניח - כשהאפקט הבולט ביותר נמדד ב-CBT לחרדה, לדיכאון ולפוסט-טראומה
          (Fernandez ועמיתיו, 2021).
        </p>

        <h2 style={h2}>הקשר הטיפולי: מה כן נחלש</h2>
        <p style={p}>
          כאן ראוי לכבד את שני צדי הוויכוח. סקירה שיטתית שהתמקדה בברית הטיפולית מצאה שמטופלים
          מדרגים את הקשר בווידאו מעט נמוך יותר מאשר פנים אל פנים - ובכל זאת הפחתת הסימפטומים
          שקולה (Norwood ועמיתיו, 2018). במילים אחרות: התחושה שמשהו מהחדר הולך לאיבוד דרך המסך
          אינה דמיון, אך היא אינה מתרגמת לתוצאה טיפולית פחותה.
        </p>

        <h2 style={h2}>מי בכלל מתחיל טיפול</h2>
        <p style={p}>
          נתון שקל לפספס: המחסום הגדול אינו תמיד איכות הטיפול אלא הפער בין ההחלטה לפנות לבין
          הפגישה הראשונה בפועל. מטא-אנליזה עדכנית של Linardon ועמיתיו (2025, Cognitive Behaviour
          Therapy) בחנה בדיוק את זה ומצאה ש<strong>פחות אנשים נושרים עוד לפני שהתחילו</strong> כאשר
          הטיפול מרחוק, בעוד ששיעורי סיום הטיפול דומים בשני הפורמטים. זה מתיישב עם מה שמטפלים
          מדווחים בשטח: מי שמתלבט חודשים מתחיל לעיתים קרובות יותר כשההתחלה אינה דורשת נסיעה.
        </p>

        <h2 style={h2}>למי זה מתאים, ולמי פחות</h2>
        <p style={p}>
          שקילות ממוצעת אינה אומרת שהפורמט מתאים לכולם באותה מידה. הדירוג הבא הוא שיקול דעת קליני
          המבוסס על היכן הראיות ההשוואתיות חזקות ועל אופי העבודה עצמה - לא מדד מדוד:
        </p>
      </div>

      <figure style={{ margin: "16px 0 8px" }}>
        <div
          className="rounded-2xl"
          style={{
            background: "#F7FAF9",
            border: `1px solid ${LINE}`,
            padding: "18px 14px",
            // Below ~590px the chart would otherwise scale down to ~42% and
            // render its 14px labels at 6px. Scrolling keeps them readable.
            overflowX: "auto",
          }}
        >
          <FitChart />
        </div>
        <figcaption style={{ fontSize: "12.5px", color: MUTED, marginTop: "10px", lineHeight: 1.7, maxWidth: "75ch" }}>
          שיקול דעת קליני, לא תוצאת מדידה. שלוש דרגות: מתאים מאוד · מתאים בתנאים · מתאים פחות.
        </figcaption>
      </figure>

      <div style={{ maxWidth: "75ch" }}>
        <h2 style={h2}>מתי עדיף להגיע לקליניקה</h2>
        <p style={p}>
          במצבי סיכון אקוטי, כשנדרשת הערכה ישירה ורצף צמוד; בגיל הרך, שבו המשחק והנוכחות המשותפת
          בחדר הם חלק מהטיפול ולא תפאורה; בטיפולים שדורשים חומרים ומגע כמו הבעה ויצירה; וכשאין
          בבית חדר שאפשר לסגור בו דלת לשעה. הפרטיות אינה פרט טכני - היא חלק מהמסגרת הטיפולית.
        </p>

        <h2 style={h2}>עלות</h2>
        <p style={p}>
          פגישה פרטית עולה בישראל לרוב בין 300 ל-550 ש&quot;ח, כשהממוצע הארצי בסקרי התעריפים נע סביב
          400 ש&quot;ח. טיפול אונליין נמצא פעמים רבות בחלק הנמוך של הטווח: המטפל חוסך את עלות
          הקליניקה. הגורם המשפיע ביותר על המחיר אינו הפורמט אלא ההכשרה והניסיון. קיימים גם מסלולים
          מסובסדים דרך קופות החולים ודרך ביטוחים משלימים.
        </p>

        <h2 style={h2}>איך להיערך לפגישה הראשונה</h2>
        <ul style={{ ...p, paddingInlineStart: "18px", listStyle: "disc" }}>
          <li>חדר עם דלת שנסגרת, ושעה שבה אף אחד לא מקשיב.</li>
          <li>אוזניות - משפרות את איכות השמע ומגבירות את תחושת האינטימיות.</li>
          <li>חיבור יציב, ובדיקה קצרה של המצלמה והמיקרופון לפני.</li>
          <li>לשאול את המטפל/ת: ניסיון בטיפול מרחוק, באיזו פלטפורמה, ומה קורה בתקלה טכנית.</li>
        </ul>

        <h2 style={h2}>מקורות</h2>
        <ul style={{ fontSize: "13.5px", lineHeight: 1.9, color: MUTED, paddingInlineStart: "18px", listStyle: "disc" }}>
          <li>
            <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10168168/" target="_blank" rel="noopener noreferrer" style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Hedman-Lagerlöf ואחרים, 2023, World Psychiatry
            </a>{" "}
            - מטא-אנליזה, 31 ניסויים מבוקרים, 3,053 משתתפים: g=0.02 (95% CI -0.09 עד 0.14).
          </li>
          <li>
            <a href="https://www.tandfonline.com/doi/full/10.1080/16506073.2017.1401115" target="_blank" rel="noopener noreferrer" style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Carlbring ואחרים, 2018, Cognitive Behaviour Therapy
            </a>{" "}
            - מטא-אנליזה, 20 מחקרים, 1,418 משתתפים: g=0.05 (95% CI -0.09 עד 0.20).
          </li>
          <li>
            <a href="https://onlinelibrary.wiley.com/doi/10.1002/cpp.2594" target="_blank" rel="noopener noreferrer" style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Fernandez ואחרים, 2021, Clinical Psychology &amp; Psychotherapy
            </a>{" "}
            - מטא-אנליזה של טיפול בווידאו; ההבדל מפנים אל פנים זניח, האפקט הבולט ב-CBT לחרדה,
            דיכאון ופוסט-טראומה.
          </li>
          <li>
            <a href="https://onlinelibrary.wiley.com/doi/10.1002/cpp.2315" target="_blank" rel="noopener noreferrer" style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Norwood ואחרים, 2018, Clinical Psychology &amp; Psychotherapy
            </a>{" "}
            - סקירה שיטתית: הברית הטיפולית מדורגת מעט נמוך יותר בווידאו, הפחתת הסימפטומים שקולה.
          </li>
          <li>
            <a href="https://pubmed.ncbi.nlm.nih.gov/40757987/" target="_blank" rel="noopener noreferrer" style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Linardon ואחרים, 2025, Cognitive Behaviour Therapy
            </a>{" "}
            - מטא-אנליזה של שיעורי אי-התחלה ונשירה; פחות אנשים נושרים לפני תחילת הטיפול באונליין,
            שיעורי הסיום דומים.
          </li>
        </ul>
        <p style={{ fontSize: "12.5px", color: MUTED, lineHeight: 1.75, marginTop: "10px" }}>
          נכתב ונערך על ידי ד&quot;ר אבשלום גליל, פסיכולוג קליני וחינוכי מומחה-מדריך וממייסדי טיפול
          חכם. המידע כאן כללי ואינו תחליף לייעוץ אישי. עודכן באוגוסט 2026.
        </p>
      </div>
    </section>
  );
}
