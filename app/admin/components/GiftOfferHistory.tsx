"use client";

import { Fragment, useState } from "react";
import { REGION_GROUP_LABELS } from "@/app/lib/regions";
import {
  countGiftOutcomes,
  type GiftOfferHistoryRow,
  type GiftOfferOutcome,
} from "@/app/lib/gift-offer-outcome";

// כל הצעות קידום המתנה שנשלחו, ומה כל נמען עשה עם ההצעה: לא לחץ, לחץ, נרשם.
// סגור כברירת מחדל ונטען רק בפתיחה (בקשת המשתמש 25/9/26), כדי שלא יאט את
// עמוד הסוכנים. ההגדרות של שלושת המצבים יושבות ב-gift-offer-outcome.ts.

const OUTCOME_ORDER: GiftOfferOutcome[] = ["registered", "opened", "not_opened", "unknown"];

const OUTCOME_LABEL: Record<GiftOfferOutcome, { m: string; f: string; x: string }> = {
  registered: { m: "נרשם", f: "נרשמה", x: "נרשם/ה" },
  opened: { m: "לחץ ולא נרשם", f: "לחצה ולא נרשמה", x: "לחץ/ה ולא נרשם/ה" },
  not_opened: { m: "לא לחץ", f: "לא לחצה", x: "לא לחץ/ה" },
  unknown: { m: "לחיצה לא נמדדה", f: "לחיצה לא נמדדה", x: "לחיצה לא נמדדה" },
};

const OUTCOME_CLS: Record<GiftOfferOutcome, string> = {
  registered: "border-[#C2DFDE] bg-[#EAF4F3] text-[#2A6462]",
  opened: "border-[#EBD3A0] bg-[#FDF6E3] text-[#A87010]",
  not_opened: "border-stone-200 bg-stone-100 text-stone-600",
  unknown: "border-dashed border-stone-300 bg-white text-stone-400",
};

function byGender(gender: string | null, forms: { m: string; f: string; x: string }): string {
  if (gender === "נקבה") return forms.f;
  if (gender === "זכר") return forms.m;
  return forms.x;
}

const IL = "Asia/Jerusalem";

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric", timeZone: IL });
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: IL });
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IL,
  });
}

// מצב המטפל היום, כדי שגם מי שקיבל קידום בדרך אחרת (לא דרך הקישור) ייראה.
function currentState(r: GiftOfferHistoryRow): string {
  switch (r.promotionSource) {
    case "gift_trial":
      return "בחודשי המתנה";
    case "paid":
      return "מנוי בתשלום";
    case "trial":
      return r.promotedUntil ? `קידום במתנה עד ${fmtShort(r.promotedUntil)}` : "קידום במתנה";
    case "manual":
      return "קידום ידני";
    case "center":
      return "מקודם דרך מרכז";
    case null:
      return r.status === "approved" ? "חינמי" : "לא מוצג באתר";
    default:
      return r.promotionSource;
  }
}

function linkState(r: GiftOfferHistoryRow, now: number): { text: string; cls: string } {
  if (r.usedAt) return { text: "נוצל", cls: "text-stone-400" };
  if (!r.expiresAt) return { text: "", cls: "" };
  const left = Date.parse(r.expiresAt) - now;
  if (left <= 0) return { text: `פג ב-${fmtShort(r.expiresAt)}`, cls: "text-stone-400" };
  const days = Math.floor(left / 86_400_000);
  const remaining = days === 0 ? "פחות מיום" : days === 1 ? "עוד יום" : `עוד ${days} ימים`;
  return { text: `בתוקף עד ${fmtShort(r.expiresAt)} (${remaining})`, cls: "text-stone-700" };
}

function outcomeDetail(r: GiftOfferHistoryRow): string {
  switch (r.outcome) {
    case "registered":
      return r.usedAt ? `ב-${fmtWhen(r.usedAt)}` : "";
    case "opened":
      return `הקישור נפתח ${r.viewCount === 1 ? "פעם אחת" : `${r.viewCount} פעמים`}${
        r.lastViewedAt ? `, לאחרונה ${fmtWhen(r.lastViewedAt)}` : ""
      }`;
    case "unknown":
      return "נשלח לפני שהתחלנו לספור לחיצות";
    default:
      return "";
  }
}

function summaryParts(rows: GiftOfferHistoryRow[]): string {
  const c = countGiftOutcomes(rows);
  const parts = [`נרשמו ${c.registered}`];
  if (c.opened > 0) parts.push(`לחצו ולא נרשמו ${c.opened}`);
  if (c.not_opened > 0) parts.push(`לא לחצו ${c.not_opened}`);
  if (c.unknown > 0) parts.push(`לא נמדד ${c.unknown}`);
  return parts.join(" · ");
}

type Batch = { day: string; rows: GiftOfferHistoryRow[] };

// הצעות יוצאות במנות, ולכן מקבצים לפי יום השליחה (שעון ישראל), מהחדש לישן.
// בתוך מנה: מי שנרשם, אחריו מי שלחץ, ואז השאר - המעניין קודם.
function toBatches(rows: GiftOfferHistoryRow[]): Batch[] {
  const batches: Batch[] = [];
  for (const r of rows) {
    const day = fmtDay(r.sentAt);
    const last = batches[batches.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else batches.push({ day, rows: [r] });
  }
  for (const b of batches) {
    b.rows.sort(
      (a, z) =>
        OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(z.outcome) || a.name.localeCompare(z.name, "he"),
    );
  }
  return batches;
}

function HistoryTable({ rows }: { rows: GiftOfferHistoryRow[] }) {
  const now = Date.now();
  const batches = toBatches(rows);
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        <span className="font-bold text-stone-800">נשלחו {rows.length} הצעות</span> · {summaryParts(rows)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-400">
              <th className="py-1.5 pe-3 text-start font-semibold">מטפל/ת</th>
              <th className="px-3 text-start font-semibold">ההצעה</th>
              <th className="px-3 text-start font-semibold">מה קרה</th>
              <th className="px-3 text-start font-semibold">הקישור</th>
              <th className="ps-3 text-start font-semibold">מצב היום</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <Fragment key={b.day}>
                <tr>
                  <td colSpan={5} className="bg-stone-50 px-2 py-1.5 text-xs font-bold text-stone-500">
                    נשלחו ב-{b.day} · {b.rows.length === 1 ? "הצעה אחת" : `${b.rows.length} הצעות`} ·{" "}
                    <span className="font-normal">{summaryParts(b.rows)}</span>
                  </td>
                </tr>
                {b.rows.map((r) => {
                  const link = linkState(r, now);
                  const detail = outcomeDetail(r);
                  return (
                    <tr key={r.offerId} className="border-b border-stone-100 align-top">
                      <td className="py-2 pe-3 font-semibold text-stone-800">{r.name}</td>
                      <td className="px-3 py-2 text-stone-600">
                        {/* חלק מהצעות 3-4/9 נשמרו עם מפתח האזור (sharon) ולא עם השם */}
                        {REGION_GROUP_LABELS[r.region] ?? r.region}
                        {r.treatment && <span className="text-stone-400"> · {r.treatment}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${OUTCOME_CLS[r.outcome]}`}
                        >
                          {r.outcome === "registered" ? "✓ " : ""}
                          {byGender(r.gender, OUTCOME_LABEL[r.outcome])}
                        </span>
                        {detail && <div className="mt-1 text-xs text-stone-400">{detail}</div>}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2 text-xs ${link.cls}`}>{link.text}</td>
                      <td className="whitespace-nowrap py-2 ps-3 text-xs text-stone-600">{currentState(r)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-5 text-stone-400">
        &quot;לחץ&quot; = הקישור האישי מהמייל נפתח. הפתיחה נספרת אצלנו בשרת, ולכן חוסם פרסומות לא מסתיר
        אותה. הספירה התחילה ב-4.9.2026, ועל הצעות שיצאו לפני כן ידוע רק מי נרשם. &quot;מצב היום&quot; מראה
        גם מי קיבל קידום בדרך אחרת.
      </p>
    </div>
  );
}

export default function GiftOfferHistory() {
  const [rows, setRows] = useState<GiftOfferHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin-gift-offers")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setRows(j.rows ?? []);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }

  return (
    <details
      className="mt-5 rounded-xl border border-stone-200 bg-stone-50/60"
      onToggle={(e) => {
        if (e.currentTarget.open && rows === null && !loading) load();
      }}
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-black text-stone-700 hover:text-stone-900">
        🎁 כל הצעות המתנה שנשלחו - מי לחץ ומי נרשם
      </summary>
      <div className="rounded-b-xl border-t border-stone-200 bg-white px-4 py-3">
        {loading && <p className="text-sm text-stone-400">טוען...</p>}
        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            <button onClick={load} className="font-bold underline">
              לנסות שוב
            </button>
          </p>
        )}
        {rows && rows.length === 0 && <p className="text-sm text-stone-400">עדיין לא נשלחה אף הצעה.</p>}
        {rows && rows.length > 0 && <HistoryTable rows={rows} />}
      </div>
    </details>
  );
}
