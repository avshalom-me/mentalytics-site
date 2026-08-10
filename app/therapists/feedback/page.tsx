"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Must match ALLOWED_REASONS in /api/therapist-feedback.
const REASONS = [
  "המחיר",
  "מעט פניות",
  "מצאתי מספיק מטופלים",
  "לא התאים לי כרגע",
  "חוויית השימוש באתר",
  "אחר",
];

function FeedbackForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const name = searchParams.get("name") ?? "";

  const [reasons, setReasons] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function toggle(r: string) {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reasons.length === 0 && !message.trim()) {
      setError("נא לבחור סיבה או לכתוב כמה מילים.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/therapist-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reasons, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError("שגיאה בשליחה. נסה/י שוב או כתוב/י ל-admin@getmentalytics.com");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("שגיאה בשליחה. נסה/י שוב או כתוב/י ל-admin@getmentalytics.com");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>

      {done ? (
        <div className="rounded-3xl border border-green-200 bg-green-50 px-8 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</div>
          <h1 className="text-2xl font-black text-stone-900">תודה על המשוב 🙏</h1>
          <p className="mx-auto mt-3 max-w-sm leading-7 text-stone-700">
            המשוב שלך עוזר לנו להשתפר. אם תרצה/י לחזור בעתיד - תמיד אפשר להירשם מחדש.
          </p>
          <Link href="/" className="mt-7 inline-block rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: "var(--teal)" }}>
            חזרה לדף הבית
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-black text-stone-900 mb-2">נשמח לשמוע ממך</h1>
          <p className="text-stone-600 leading-7 mb-6">
            מצטערים לראות אותך עוזב/ת. אם יש דקה - ספר/י לנו מה גרם לביטול. זה עוזר לנו להשתפר עבור המטפלים הבאים.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="mb-2 text-sm font-semibold text-stone-800">מה הסיבה לביטול? (אפשר לבחור כמה)</div>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm hover:bg-stone-50">
                    <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggle(r)} className="h-4 w-4 accent-[#3D8C8A]" />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-stone-800">משהו נוסף שתרצה/י לשתף? (לא חובה)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#3D8C8A]"
                placeholder="הערות, תלונות, או הצעות לשיפור..."
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}
            >
              {loading ? "שולח..." : "שליחת המשוב"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

export default function TherapistFeedbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <FeedbackForm />
    </Suspense>
  );
}
