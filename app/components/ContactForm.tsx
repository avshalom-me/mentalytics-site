"use client";

import { useState } from "react";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("sent");
        setForm({ name: "", email: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") return (
    <div className="mt-5 rounded-2xl bg-green-50 border border-green-200 p-5 text-center">
      <div className="text-3xl mb-2">✅</div>
      <p className="font-bold text-green-800">הפנייה נשלחה בהצלחה!</p>
      <p className="text-sm text-green-700 mt-1">נחזור אליך תוך 24 שעות.</p>
      <button onClick={() => setStatus("idle")} className="mt-3 text-xs text-green-600 underline">שליחת פנייה נוספת</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">שם מלא *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="ישראל ישראלי"
            className="w-full rounded-xl border border-[#E0D5C8] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#0F5468] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">כתובת מייל *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="example@gmail.com"
            className="w-full rounded-xl border border-[#E0D5C8] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#0F5468] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1">נושא</label>
        <input
          type="text"
          value={form.subject}
          onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
          placeholder="שאלה, הערה, בקשה..."
          className="w-full rounded-xl border border-[#E0D5C8] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#0F5468] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1">הודעה *</label>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          placeholder="כתוב/י את שאלתך או הערתך כאן..."
          className="w-full rounded-xl border border-[#E0D5C8] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#0F5468] focus:outline-none resize-none"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">אירעה שגיאה בשליחה. אנא נסה שוב.</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "#0F5468" }}
      >
        {status === "sending" ? "שולח..." : "שלח פנייה ▸"}
      </button>
    </form>
  );
}
