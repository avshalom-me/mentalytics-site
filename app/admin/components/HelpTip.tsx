"use client";

import { useEffect, useState } from "react";
import { HELP } from "../help-content";

// The (?) affordance next to every CRM section title. Hover shows the
// one-liner (native tooltip); click opens a full explanation drawer with the
// fixed structure: what / how / where-from / what-to-do.
export default function HelpTip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const entry = HELP[id];

  // Escape closes the drawer — cheap and expected.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!entry) return null;

  return (
    <>
      <button
        type="button"
        title={entry.short}
        aria-label={`הסבר: ${entry.title}`}
        onClick={() => setOpen(true)}
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-[11px] font-bold text-teal-700 hover:bg-teal-100 align-middle"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50" dir="rtl" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-stone-900">{entry.title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="rounded-full px-2 py-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                ✕
              </button>
            </div>
            <p className="mb-5 text-sm font-semibold text-teal-700">{entry.short}</p>

            <HelpSection label="מה זה מציג" body={entry.what} />
            {entry.how && <HelpSection label="איך זה עובד" body={entry.how} />}
            {entry.source && <HelpSection label="מאיפה הנתונים" body={entry.source} />}
            {entry.actions && <HelpSection label="מה עושים עם זה" body={entry.actions} />}
          </aside>
        </div>
      )}
    </>
  );
}

function HelpSection({ label, body }: { label: string; body: string }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs font-black text-stone-400">{label}</div>
      <p className="text-sm leading-relaxed text-stone-700 whitespace-pre-line">{body}</p>
    </div>
  );
}
