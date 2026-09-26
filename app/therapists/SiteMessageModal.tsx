"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { gaEvent } from "@/app/lib/gtag";
import { tfaEvent } from "@/app/lib/taboola";

type Props = {
  /** מזהה המטפל/ת, או מזהה חשבון המרכז כש-target="center". */
  therapistId: string;
  therapistName: string;
  source: "directory" | "match" | "profile";
  open: boolean;
  onClose: () => void;
  /**
   * "center" = פנייה למרכז מסלול-1, שאין לו שורת מטפל ולכן גם לא נתיב
   * contact-therapist. אותו טופס בדיוק, נתיב אחר.
   */
  target?: "therapist" | "center";
  /**
   * הנמען הוא מרכז, גם כשהניתוב עובר דרך שורת מטפל (ישות-מרכז, מסלול 2).
   * target קובע לאן נשלח; זה קובע איך מדברים. עד 14/9/26 הניסוח נגזר מ-target
   * בלבד, ולכן מי שכתב למרכז - גם מעמוד המרכז עצמו - קרא ש"ההודעה תישלח
   * ישירות למטפל/ת" ושפרטיו יימסרו "אליו/אליה".
   */
  recipientIsCenter?: boolean;
  /** "en" = the English page (/en). The recipient still gets the usual email; only the form speaks English. */
  lang?: "he" | "en";
};

const TEXT = {
  he: {
    sendFailed: "שגיאה בשליחה",
    sentTitle: "ההודעה נשלחה ✓",
    sentBody: (to: React.ReactNode) => <>ההודעה שלך נשלחה ל{to}. תקבל/י תגובה ישירות לפרטי הקשר שהזנת.</>,
    close: "סגירה",
    title: "שליחת הודעה",
    to: (to: React.ReactNode) => <>ל{to}</>,
    name: "שם מלא",
    contact: "טלפון או מייל לחזרה",
    contactPlaceholder: "0501234567 או your@email.com",
    message: "ההודעה",
    messagePlaceholder: "ספר/י בקצרה במה את/ה זקוק/ה לעזרה ומה שעות נוחות לחזרה אלייך",
    sending: "שולח...",
    send: "שליחה",
    noteCenter: "ההודעה תישלח ישירות למרכז. פרטי הקשר שלך יימסרו לצוות המרכז כדי שיוכלו לחזור אלייך.",
    noteTherapist: "ההודעה תישלח ישירות למטפל/ת. פרטי הקשר שלך יימסרו אליו/אליה כדי שיוכל/תוכל לחזור אלייך.",
  },
  en: {
    sendFailed: "The message could not be sent. Please try again.",
    sentTitle: "Message sent ✓",
    sentBody: (to: React.ReactNode) => <>Your message was sent to {to}. The reply will come straight to the contact details you entered.</>,
    close: "Close",
    title: "Send a message",
    to: (to: React.ReactNode) => <>To {to}</>,
    name: "Full name",
    contact: "Phone or email for a reply",
    contactPlaceholder: "050-1234567 or you@email.com",
    message: "Your message",
    messagePlaceholder: "Briefly, what would you like help with, and when is a good time to reach you?",
    sending: "Sending...",
    send: "Send",
    noteCenter: "Your message goes directly to the clinic. Your contact details are shared with the clinic's team so they can get back to you.",
    noteTherapist: "Your message goes directly to the therapist. Your contact details are shared with them so they can get back to you.",
  },
};

export default function SiteMessageModal({
  therapistId,
  therapistName,
  source,
  open,
  onClose,
  target = "therapist",
  recipientIsCenter = false,
  lang = "he",
}: Props) {
  const t = TEXT[lang];
  const en = lang === "en";
  // The name stays in Hebrew on the English page: isolated, so it cannot pull
  // the surrounding English out of order.
  const recipient = en ? <bdi lang="he">{therapistName}</bdi> : therapistName;
  const toCenter = target === "center";
  const speaksToCenter = toCenter || recipientIsCenter;
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
      const res = await fetch(toCenter ? "/api/contact-center" : "/api/contact-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(toCenter ? { center_id: therapistId } : { therapist_id: therapistId }),
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
        setError(en ? t.sendFailed : json.error || t.sendFailed);
      } else {
        setDone(true);
        // GA4 conversion: patient sent a site message to a therapist (a lead).
        gaEvent("generate_lead", { method: "site_message", source });
        // אותה פנייה גם ל-Taboola: זה הכפתור היחיד בפס הצף במובייל כשאין
        // טלפון, ובלעדיו הקמפיין רואה פחות פניות ממה שהאדמין סופר.
        tfaEvent("contact");
      }
    } catch {
      setError(t.sendFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // portal ל-body: בלעדיו, אב עם backdrop-filter/transform (למשל פס הקשר
  // הדביק בעמוד מרכז) הופך ל-containing block של ה-fixed והמודאל נחתך בתוכו.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      // z-[110] - מעל ה-NavBar הדביק (z-100), כמו מודאלי האדמין
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        dir={en ? "ltr" : "rtl"}
        lang={en ? "en" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 className="text-xl font-extrabold text-stone-900 mb-2">{t.sentTitle}</h2>
            <p className="text-sm text-stone-700 leading-6 mb-5">
              {t.sentBody(recipient)}
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[#2e7d8c] py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              {t.close}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-extrabold text-stone-900">{t.title}</h2>
                <p className="text-xs text-stone-500 mt-1">{t.to(recipient)}</p>
              </div>
              <button
                onClick={onClose}
                aria-label={t.close}
                className="text-stone-400 hover:text-stone-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">{t.name}</label>
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
                  {t.contact}
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  required
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                  placeholder={t.contactPlaceholder}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">{t.message}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c] resize-none"
                  placeholder={t.messagePlaceholder}
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
                {submitting ? t.sending : t.send}
              </button>

              <p className="text-xs text-stone-500 leading-5 mt-2">
                {speaksToCenter ? t.noteCenter : t.noteTherapist}
              </p>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
