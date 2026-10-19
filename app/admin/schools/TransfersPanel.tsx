"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../components/HelpTip";
import { MATCH_REASON_LABELS, type MatchConfidence, type MatchReason } from "@/app/lib/schools-crm";

// התאמת העברות: זיכויים מדף הבנק (נטען מהקובץ החודשי ל-statement_lines) מול
// תשלומים צפויים של רישיונות. לכל זיכוי מוצגות ההצעות; "שיוך" רושם את התשלום
// כהתקבל בהעברה ומפעיל את הרישיון. התאמה ודאית (סכום + סמל מוסד או מספר
// דרישה) מיושמת גם לבד בקרון היומי, ואפשר להפעיל אותה מכאן.

type Candidate = {
  payment: { id: string; seq: number; amount_gross: number; due_date: string | null; proforma_number: string | null; school_name: string; school_symbol: string | null };
  confidence: MatchConfidence;
  reasons: MatchReason[];
};
type Proposal = { id: string; line_date: string; amount: number; description: string; reference: string | null; candidates: Candidate[] };
type Data = { proposals: Proposal[]; other_credits: number; expected: number };

const hebDate = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().map(Number).join(".") : "");
const shekel = (n: number) => `${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ש"ח`;
const CONFIDENCE: Record<MatchConfidence, { label: string; cls: string }> = {
  strong: { label: "ודאי", cls: "bg-[#EAF4F3] text-[#2A6462]" },
  amount: { label: "אותו סכום", cls: "bg-[#FDF6E3] text-[#A87010]" },
  key: { label: "רמז בלבד", cls: "bg-stone-100 text-stone-500" },
};

export default function TransfersPanel({ onMatched, say }: { onMatched: () => Promise<void>; say: (m: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin-schools/licenses?transfers=1", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setData({ proposals: j.proposals, other_credits: j.other_credits, expected: j.expected });
    } catch {
      /* הפאנל אינו חוסם את המסך */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>, key: string, done: (j: Record<string, unknown>) => string) {
    setBusy(key);
    try {
      const r = await fetch("/api/admin-schools/licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "שגיאה");
      await Promise.all([load(), onMatched()]);
      say(done(j));
    } catch (e) {
      say(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return null;
  const sure = data.proposals.filter((p) => p.candidates.filter((c) => c.confidence === "strong" && (c.reasons.includes("symbol") || c.reasons.includes("proforma"))).length === 1).length;

  return (
    <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-black text-stone-900">התאמת העברות מדף הבנק</h2>
          <HelpTip id="school-transfers" />
        </div>
        {sure > 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act({ action: "auto_match" }, "auto", (j) => `${j.matched} העברות שויכו.`)}
            className="rounded-full bg-[#3D8C8A] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "auto" ? "משייך..." : `שיוך ${sure} התאמות ודאיות`}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {data.expected === 0
          ? "אין כרגע תשלומים צפויים, אז אין למה להתאים."
          : data.proposals.length === 0
            ? `אין זיכוי בבנק שמתאים ל-${data.expected} התשלומים הצפויים.`
            : `${data.proposals.length} זיכויים עם הצעה. התאמה ודאית (סכום + סמל מוסד או מספר דרישה) מיושמת לבד בקרון היומי; אותו סכום בלבד דורש לחיצה.`}
        {data.other_credits > 0 ? ` עוד ${data.other_credits} זיכויים בלי הצעה.` : ""}{" "}
        דף הבנק נטען בפקודה הרגילה של סוכן התקציב.
      </p>

      {data.proposals.length > 0 && (
        <div className="mt-3 space-y-3">
          {data.proposals.map((p) => (
            <div key={p.id} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-black text-stone-900">{shekel(p.amount)}</span>
                <span className="text-stone-600">{hebDate(p.line_date)}</span>
                <span className="text-stone-500">{p.description.slice(0, 90)}{p.reference ? ` (אסמכתא ${p.reference})` : ""}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {p.candidates.map((c) => {
                  const conf = CONFIDENCE[c.confidence];
                  const key = `${p.id}:${c.payment.id}`;
                  return (
                    <li key={key} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${conf.cls}`}>{conf.label}</span>
                      <span className="font-bold text-stone-800">{c.payment.school_name}</span>
                      {c.payment.school_symbol && <span className="text-xs text-stone-500">סמל {c.payment.school_symbol}</span>}
                      <span className="text-stone-600">תשלום {c.payment.seq}, {shekel(c.payment.amount_gross)}{c.payment.due_date ? `, עד ${hebDate(c.payment.due_date)}` : ""}</span>
                      <span className="text-xs text-stone-400">{c.reasons.map((r) => MATCH_REASON_LABELS[r]).join(", ")}</span>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => act({ action: "match_transfer", payment_id: c.payment.id, statement_line_id: p.id }, key, () => "ההעברה שויכה, התשלום נרשם.")}
                        className="rounded-full border border-[#3D8C8A] px-3 py-0.5 text-xs font-bold text-[#2A6462] disabled:opacity-50"
                      >
                        {busy === key ? "משייך..." : "שיוך"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
