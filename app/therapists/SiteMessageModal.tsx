"use client";

import { useEffect, useState } from "react";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { gaEvent } from "@/app/lib/gtag";

type Props = {
  therapistId: string;
  therapistName: string;
  source: "directory" | "match" | "profile";
  open: boolean;
  onClose: () => void;
};

export default function SiteMessageModal({
  therapistId,
  therapistName,
  source,
  open,
  onClose,
}: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setName("");
      setContact("");
      setMessage("");
      setError("");
      setDone(false);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: therapistId,
          sender_name: name,
          sender_contact: contact,
          message,
          source,
          session_id: getOrCreateSessionId(),
          ...(getAttribution() ?? {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "שגיאה בשליחה");
      } else {
        setDone(true);
        // GA4 conversion: patient sent a site message to a therapist (a lead).
        gaEvent("generate_lead", { method: "site_message", source });
      }
    } catch {
      setError("שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      // z-[110] — מעל ה-NavBar הדביק (z-100), כמו מודאלי האדמין
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 className="text-xl font-extrabold text-stone-900 mb-2">ההודעה נשלחה ✓</h2>
            <p className="text-sm text-stone-700 leading-6 mb-5">
              ההודעה שלך נשלחה ל{therapistName}. תקבל/י תגובה ישירות לפרטי הקשר שהזנת.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[#2e7d8c] py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              סגירה
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-extrabold text-stone-900">שליחת הודעה</h2>
                <p className="text-xs text-stone-500 mt-1">ל{therapistName}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="סגירה"
                className="text-stone-400 hover:text-stone-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">שם מלא</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  טלפון או מייל לחזרה
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  required
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                  placeholder="0501234567 או your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">ההודעה</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c] resize-none"
                  placeholder="ספר/י בקצרה במה את/ה זקוק/ה לעזרה ומה שעות נוחות לחזרה אלייך"
                />
                <p className="mt-1 text-xs text-stone-400">{message.length}/2000</p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#2e7d8c] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "שולח..." : "שליחה"}
              </button>

              <p className="text-xs text-stone-500 leading-5 mt-2">
                ההודעה תישלח ישירות למטפל/ת. פרטי הקשר שלך יימסרו אליו/אליה כדי שיוכל/תוכל לחזור אלייך.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
