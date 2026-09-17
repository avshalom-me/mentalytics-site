import type { CenterHealth, CenterHealthReport, HealthSeverity } from "@/app/lib/center-health";
import PrintButton from "@/app/centers/PrintButton";

// דף השיחה: מה שהיה מסמך ידני לעומר ב-17/9/26, מיוצר מאותם דגלים שהכרטיס
// באדמין והסוכן מציגים. שרת בלבד, מוכן להדפסה/שמירה כ-PDF, בלי פרטי
// מטופלים. מוגש משני מקומות: מהאדמין (Basic Auth) ומקישור חתום עם תפוגה
// (call-sheet-token) - אותו רכיב, כדי ששני הצדדים יראו בדיוק אותו דף.

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  critical: "דחוף מאוד",
  high: "דחוף",
  normal: "לבדוק",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
}

function billingText(h: CenterHealth): string {
  if (!h.billingStartsAt) return "";
  if (h.daysToBilling === null) return "";
  if (h.daysToBilling < 0) return `חיוב פעיל מ-${fmtDate(h.billingStartsAt)}`;
  return `חיוב מ-${fmtDate(h.billingStartsAt)} (בעוד ${h.daysToBilling} ימים)`;
}

function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function CenterCallSheet({
  report,
  only,
  title = "מכונים: חשיפה, פניות ונקודות לשיחה",
}: {
  report: CenterHealthReport;
  /** מזהה מרכז יחיד - דף למכון אחד. */
  only?: string;
  title?: string;
}) {
  const centers = only ? report.centers.filter((c) => c.id === only) : report.centers;
  const flagged = centers.filter((c) => c.flags.length > 0);
  const bench = report.benchmark;
  const generated = new Date(report.generatedAt).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });

  return (
    <main dir="rtl" className="mx-auto max-w-4xl px-6 py-8 text-[var(--text)]" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          .print\\:hidden { display: none !important; }
          .sheet-center { break-inside: avoid; }
          h2 { break-after: avoid; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
        .sheet table { width: 100%; border-collapse: collapse; font-size: 12.5px; line-height: 1.45; }
        .sheet th { background: var(--teal-pale); color: var(--teal-dark); font-weight: 700; text-align: start; padding: 5px 7px; border: 1px solid var(--line); vertical-align: bottom; }
        .sheet td { padding: 5px 7px; border: 1px solid var(--line); vertical-align: top; }
        .sheet td.n { text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .sheet tr.bench td { background: var(--surface); color: var(--text-2); font-style: italic; }
        .sheet ul.check { list-style: none; padding: 0; margin: 0; }
        .sheet ul.check li { position: relative; padding-inline-start: 24px; margin-bottom: 5px; line-height: 1.55; }
        .sheet ul.check li::before { content: ""; position: absolute; inset-inline-start: 0; top: 5px; width: 13px; height: 13px; border: 1.5px solid var(--teal); border-radius: 3px; }
      `}</style>

      <div className="sheet">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ letterSpacing: "-.01em" }}>{title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              נכון ל-{generated} · הנתונים הם של {report.demand.windowDays} הימים האחרונים, ולמכון שהצטרף בתוך התקופה, מיום ההצטרפות.
            </p>
          </div>
          <PrintButton />
        </div>

        {!only && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-extrabold text-[var(--teal-dark)]">בקצרה</h2>
            {flagged.length === 0 ? (
              <p className="text-sm">אף מכון לא מסומן כרגע. הטבלה למטה מציגה את המספרים של כולם.</p>
            ) : (
              <ol className="list-decimal space-y-1 ps-6 text-[15px] leading-7">
                {flagged.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong>: {c.flags[0].label}
                    {c.flags.length > 1 ? ` ועוד ${c.flags.length - 1}` : ""}
                    {c.severity && c.severity !== "normal" ? ` (${SEVERITY_LABEL[c.severity]})` : ""}
                    {billingText(c) ? ` · ${billingText(c)}` : ""}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {!only && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-extrabold text-[var(--teal-dark)]">תמונת מצב</h2>
            <p className="mb-2 text-sm text-[var(--text-2)]">
              הופעות בשאלון, הופעות ברשימות, כניסות לפרופיל ופניות - סכום המרכז. במסלול 1 זה סכום כל המטפלים יחד.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>מכון</th><th>מסלול</th><th>חיוב</th><th>מטפלים</th><th>בשאלון</th><th>ברשימות</th><th>כניסות</th><th>פניות</th><th>הדגל המרכזי</th>
                  </tr>
                </thead>
                <tbody>
                  {centers.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td className="n">{c.track === "center_entity" ? "2" : "1"}</td>
                      <td className="n">{fmtDate(c.billingStartsAt)}</td>
                      <td className="n">{c.track === "center_entity" ? "-" : `${c.slots?.promoted ?? 0}/${c.slots?.paid ?? 0}`}</td>
                      <td className="n">{c.totals.cards}</td>
                      <td className="n">{c.totals.list}</td>
                      <td className="n">{c.totals.opens}</td>
                      <td className="n">{c.totals.contacts}</td>
                      <td>{c.flags[0]?.label ?? "-"}</td>
                    </tr>
                  ))}
                  {bench && (
                    <tr className="bench">
                      <td>להשוואה: מטפל פרטי משלם, ממוצע ל-30 יום ({bench.peers} מטפלים)</td>
                      <td></td><td></td><td></td>
                      <td className="n">{num(bench.cards)}</td>
                      <td className="n">{num(bench.list)}</td>
                      <td className="n">{num(bench.opens)}</td>
                      <td className="n">{num(bench.contacts)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {centers.map((c) => (
          <section key={c.id} className="sheet-center mb-8 border-t border-[var(--line)] pt-6">
            <h2 className="text-lg font-extrabold text-[var(--teal-dark)]">
              {c.name}
              <span className="ms-2 text-sm font-medium text-[var(--muted)]">
                {c.trackLabel}{billingText(c) ? ` · ${billingText(c)}` : ""}
              </span>
            </h2>

            {c.perUnit30 && bench && (
              <p className="mt-1 text-sm text-[var(--text-2)]">
                למטפל, ב-30 יום: {num(c.perUnit30.cards)} הופעות בשאלון ו-{num(c.perUnit30.contacts)} פניות,
                לעומת {num(bench.cards)} ו-{num(bench.contacts)} אצל מטפל פרטי משלם.
                {c.demand.regions.length > 0 && ` באזור המרכז נערכו ${c.demand.searches} חיפושים בשאלון.`}
              </p>
            )}

            {c.flags.length > 0 ? (
              <>
                <p className="mb-1 mt-3 text-sm font-bold">מה לבדוק בשיחה</p>
                <ul className="check text-[14px]">
                  {c.flags.map((f) => (
                    <li key={f.key}>
                      <strong>{f.label}.</strong> {f.question}
                      <span className="block text-[12.5px] text-[var(--muted)]">{f.detail}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">אין דגלים פתוחים.</p>
            )}

            {c.readiness.missingForCenter.length > 0 && (
              <p className="mt-3 text-[13px] text-[var(--text-2)]">
                חסר בפרופיל המרכז: {c.readiness.missingForCenter.map((i) => i.label).join(" · ")}
              </p>
            )}

            {c.track === "per_therapist" && c.therapists.length > 0 && (
              <div className="mt-3" style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr><th>מטפל/ת</th><th>מטפל ב-</th><th>אונליין</th><th>בשאלון</th><th>ברשימות</th><th>כניסות</th><th>פניות</th></tr>
                  </thead>
                  <tbody>
                    {c.therapists.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.ages.length > 0 ? t.ages.join(", ") : "-"}</td>
                        <td className="n">{t.online ? "כן" : "לא"}</td>
                        <td className="n">{t.cards}</td>
                        <td className="n">{t.list}</td>
                        <td className="n">{t.opens}</td>
                        <td className="n">{t.contacts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        <p className="mt-6 text-xs text-[var(--muted)]">
          פנייה = לחיצה על וואטסאפ או טלפון, או הודעה שנשלחה מהאתר. המספר הוא רצפה: מי שראה שם יכול לחפש אותו בגוגל ולפנות ישירות, וזה לא נספר כאן.
          כל תוספת לפרופיל של מטפל, כמו אונליין, ערים או תחומי טיפול, נכנסת רק אם היא נכונה בפועל.
        </p>
      </div>
    </main>
  );
}
