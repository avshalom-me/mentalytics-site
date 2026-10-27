"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { reviewToken } from "@/app/kids/review/session";
import { ALL_FEATURES_ON, type SchoolFeatureFlags } from "@/app/lib/schools-crm";
import { SchoolFeaturesContext } from "./features";

// שער הרישיון של שאלון היועצות. שואל את השרת אם לדפדפן הזה יש הרשאה בתוקף
// (עוגיית HttpOnly, app/lib/school-gate.server.ts). כשהשער דולק ואין הרשאה,
// מוצג מסך קוד הגישה במקום השאלון. כשהשער כבוי, השאלון נפתח כרגיל, ומי שיש
// לו קוד יכול להקליד אותו מהקישור הקטן בראש העמוד.
//
// מצב הביקורת (קישור אישי לבודק) עוקף את השער בשרת, ולכן גם כאן: כשיש טוקן
// ביקורת בדפדפן, השאלון נפתח בלי מסך קוד.

type Status = { gate: boolean; licensed: boolean; school?: string | null; end_date?: string; features?: SchoolFeatureFlags };

export const SCHOOL_GATE_EVENT = "school-license-required";

function hasReviewToken(): boolean {
  try {
    return !!reviewToken();
  } catch {
    return false;
  }
}

async function fetchStatus(): Promise<Status> {
  try {
    const r = await fetch("/api/school-access", { cache: "no-store" });
    const d = (await r.json()) as Status & { ok: boolean };
    // features מגיע כדגלים (true = זמין). חסר או לא תקין = הכול דלוק; החסימה בשרת.
    const features = d.features && typeof d.features === "object"
      ? { ai_explain: d.features.ai_explain !== false, therapist_search: d.features.therapist_search !== false }
      : ALL_FEATURES_ON;
    return { gate: !!d.gate, licensed: !!d.licensed, school: d.school ?? null, end_date: d.end_date, features };
  } catch {
    // השרת לא ענה: לא חוסמים על סמך כלום. אם השער דולק, הניקוד ייחסם בשרת ממילא.
    return { gate: false, licensed: false };
  }
}

export default function SchoolGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    // נתיב הניקוד החזיר 403: הרישיון פג או בוטל באמצע העבודה.
    const onRequired = () => {
      setStatus((s) => ({ gate: true, licensed: false, school: s?.school ?? null }));
      setShowCode(true);
    };
    window.addEventListener(SCHOOL_GATE_EVENT, onRequired);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHOOL_GATE_EVENT, onRequired);
    };
  }, []);

  const refresh = () => fetchStatus().then(setStatus);

  if (!status) return null;
  const reviewing = hasReviewToken();
  const blocked = status.gate && !status.licensed && !reviewing;

  if (blocked || showCode) {
    return (
      <CodeScreen
        gateOn={status.gate}
        onDone={async () => {
          setShowCode(false);
          await refresh();
        }}
        onCancel={blocked ? undefined : () => setShowCode(false)}
      />
    );
  }

  return (
    <SchoolFeaturesContext.Provider value={status.licensed ? (status.features ?? ALL_FEATURES_ON) : ALL_FEATURES_ON}>
      {status.licensed ? (
        <div dir="rtl" className="mx-auto max-w-3xl px-4 pt-3 text-xs text-[var(--muted)]">
          מחובר/ת: {status.school ?? "בית הספר"}{status.end_date ? `, רישיון עד ${formatHe(status.end_date)}` : ""}.
        </div>
      ) : status.gate ? null : (
        <div dir="rtl" className="mx-auto max-w-3xl px-4 pt-3 text-xs text-[var(--muted)]">
          לבית הספר יש קוד גישה?{" "}
          <button type="button" onClick={() => setShowCode(true)} className="underline">להקלדת הקוד</button>
        </div>
      )}
      {children}
    </SchoolFeaturesContext.Provider>
  );
}

function formatHe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

function CodeScreen({ gateOn, onDone, onCancel }: { gateOn: boolean; onDone: () => void | Promise<void>; onCancel?: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/school-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setError(typeof d.error === "string" ? d.error : "הקוד לא התקבל.");
        return;
      }
      await onDone();
    } catch {
      setError("לא הצלחנו לבדוק את הקוד. אפשר לנסות שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-black text-[var(--text)]">שאלון היועצות</h1>
      <p className="mt-3 text-[var(--text-2)]">
        {gateOn
          ? "השאלון פתוח לבתי ספר שיש להם רישיון. אם בית הספר שלך קיבל קוד גישה, מקלידים אותו פעם אחת במכשיר הזה."
          : "מקלידים את קוד הגישה של בית הספר, ומכאן השאלון יזהה את בית הספר במכשיר הזה."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm font-bold text-[var(--text)]" htmlFor="school-code">קוד הגישה של בית הספר</label>
        <input
          id="school-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="למשל ABCD-2345"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          dir="ltr"
          className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-[var(--teal)]"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || code.trim().length < 8}
            className="rounded-full bg-[var(--teal)] px-6 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {busy ? "בודקים..." : "כניסה"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-sm text-[var(--muted)] underline">ביטול</button>
          )}
        </div>
      </form>
      <div className="mt-10 rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--text-2)]">
        <p className="font-bold text-[var(--text)]">אין לבית הספר קוד?</p>
        <p className="mt-1">
          השאלון ניתן לבתי ספר ולרשויות ברישיון שנתי.{" "}
          <Link href="/counselors#access" className="font-bold text-[var(--teal-dark)] underline">לקבלת פרטים וגישה לבית הספר</Link>
        </p>
      </div>
    </main>
  );
}
