"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type Settings = {
  fontSize: number;       // 0 = normal, 1 = large, 2 = larger
  contrast: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
};

const DEFAULTS: Settings = { fontSize: 0, contrast: false, highlightLinks: false, readableFont: false };

const HIDDEN_ROUTES = ["/adults", "/kids"];

export default function AccessibilityWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("a11y");
      if (saved) setS(JSON.parse(saved));
    } catch {}
  }, []);

  // Apply settings to <html>
  useEffect(() => {
    const html = document.documentElement;
    // Font size
    html.style.fontSize = s.fontSize === 1 ? "112%" : s.fontSize === 2 ? "125%" : "";
    // High contrast
    html.classList.toggle("a11y-contrast", s.contrast);
    // Highlight links
    html.classList.toggle("a11y-links", s.highlightLinks);
    // Readable font
    html.classList.toggle("a11y-font", s.readableFont);
    // Persist
    try { localStorage.setItem("a11y", JSON.stringify(s)); } catch {}
  }, [s]);

  // Hide on questionnaire pages
  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null;

  function update(patch: Partial<Settings>) {
    setS(prev => ({ ...prev, ...patch }));
  }

  function reset() {
    setS(DEFAULTS);
  }

  const isActive = s.fontSize > 0 || s.contrast || s.highlightLinks || s.readableFont;

  return (
    <>
      {/* Global CSS for accessibility modes */}
      <style>{`
        .a11y-contrast { filter: contrast(1.5) brightness(1.05); }
        .a11y-links a { text-decoration: underline !important; outline: 2px solid currentColor !important; outline-offset: 2px !important; }
        .a11y-font, .a11y-font * { font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.03em !important; }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="פתח תפריט נגישות"
        aria-expanded={open}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F5468]"
        style={{ background: isActive ? "#0F5468" : "#1a3a5c" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="22" height="22" aria-hidden="true">
          <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 5H4a1 1 0 0 0 0 2h3.5l-1.8 8.1A1 1 0 0 0 6.7 18h.1l2.2-.7 1 3.8a1 1 0 0 0 1.9-.5l-1-3.8 2.2.7h.1a1 1 0 0 0 1-.7L12.5 9H20a1 1 0 0 0 0-2z"/>
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="אפשרויות נגישות"
          dir="rtl"
          className="fixed bottom-20 left-6 z-50 w-64 rounded-2xl bg-white shadow-xl border border-[#E8E0D8] p-4"
          style={{ fontFamily: "Heebo, Arial, sans-serif" }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-stone-900 text-sm">נגישות</span>
            <button onClick={() => setOpen(false)} aria-label="סגור" className="text-stone-400 hover:text-stone-700 text-lg leading-none">✕</button>
          </div>

          <div className="space-y-2">
            {/* Font size */}
            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
              <span className="text-sm text-stone-700">גודל גופן</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => update({ fontSize: Math.max(0, s.fontSize - 1) })}
                  aria-label="הקטן גופן"
                  className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold text-base hover:bg-stone-100 flex items-center justify-center"
                >−</button>
                <span className="text-xs text-stone-500 w-5 text-center">{s.fontSize === 0 ? "רגיל" : s.fontSize === 1 ? "גדול" : "גדול+"}</span>
                <button
                  onClick={() => update({ fontSize: Math.min(2, s.fontSize + 1) })}
                  aria-label="הגדל גופן"
                  className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold text-base hover:bg-stone-100 flex items-center justify-center"
                >+</button>
              </div>
            </div>

            {/* Toggle options */}
            {([
              { label: "ניגודיות גבוהה", key: "contrast" },
              { label: "הדגשת קישורים", key: "highlightLinks" },
              { label: "גופן קריא", key: "readableFont" },
            ] as { label: string; key: keyof Settings }[]).map(({ label, key }) => (
              <button
                key={key}
                onClick={() => update({ [key]: !s[key] })}
                aria-pressed={!!s[key]}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition"
                style={{
                  background: s[key] ? "#EAF4F8" : "#F9F7F5",
                  color: s[key] ? "#0F5468" : "#44403c",
                  border: s[key] ? "1px solid #B0D8E8" : "1px solid #E8E0D8",
                  fontWeight: s[key] ? 600 : 400,
                }}
              >
                <span>{label}</span>
                <span>{s[key] ? "✓" : ""}</span>
              </button>
            ))}
          </div>

          {isActive && (
            <button
              onClick={reset}
              className="mt-3 w-full text-xs text-stone-400 hover:text-stone-600 underline text-center"
            >
              איפוס הגדרות
            </button>
          )}
        </div>
      )}
    </>
  );
}
