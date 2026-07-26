"use client";

import { useState } from "react";
import { getAttribution } from "@/app/lib/attribution";

// Small anonymous feedback box shown on the quiz results screen:
// "משהו לא ברור או לא הסתדר? ספרו לנו". Posts to /api/quiz-feedback →
// crm_leads, so answers surface in the admin leads screen. Contact optional.
export default function QuizFeedbackBox({ quizType }: { quizType: "adults" | "kids" }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    if (!message.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/quiz-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contact, quiz_type: quizType, ...(getAttribution() ?? {}) }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div
        dir="rtl"
        className="mt-8 rounded-2xl p-4 text-center text-sm font-semibold"
        style={{ background: "var(--teal-pale, #EAF4F3)", color: "var(--teal-dark, #2A6462)" }}
      >
        תודה רבה! המשוב התקבל ויעזור לנו להשתפר 🙏
      </div>
    );
  }

  return (
    <div dir="rtl" className="mt-8 text-center">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--muted, #6B807E)" }}
        >
          משהו לא ברור או לא הסתדר? ספרו לנו ←
        </button>
      ) : (
        <div
          className="mx-auto max-w-md rounded-2xl border p-4 text-start"
          style={{ borderColor: "var(--line, #DDE9E8)", background: "#fff" }}
        >
          <p className="mb-2 text-sm font-bold" style={{ color: "var(--text-2, #3E5250)" }}>
            משהו לא ברור או לא הסתדר? ספרו לנו
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="מה לא עבד או לא היה ברור? כל פרט עוזר לנו…"
            className="w-full rounded-xl border p-3 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--line, #DDE9E8)" }}
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            placeholder="טלפון או מייל לחזרה (לא חובה)"
            className="mt-2 w-full rounded-xl border p-2.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--line, #DDE9E8)" }}
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px]" style={{ color: "var(--faint, #A2B5B4)" }}>
              נשלח אנונימית אלא אם השארתם פרט קשר
            </span>
            <button
              type="button"
              onClick={send}
              disabled={!message.trim() || state === "sending"}
              className="rounded-full px-5 py-2 text-sm font-bold text-white transition disabled:opacity-40"
              style={{ background: "var(--teal, #3D8C8A)" }}
            >
              {state === "sending" ? "שולח…" : "שליחה"}
            </button>
          </div>
          {state === "error" && (
            <p className="mt-2 text-xs text-red-600">השליחה נכשלה - נסו שוב רגע.</p>
          )}
        </div>
      )}
    </div>
  );
}
