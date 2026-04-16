"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type ContrastMode = "none" | "mono" | "light" | "dark";
type FontSize = 0 | 155 | 175 | 200;

type Settings = {
  fontSize: FontSize;
  contrast: ContrastMode;
  accessibleFont: boolean;
  highlightLinks: boolean;
  highlightHeadings: boolean;
};

const DEFAULTS: Settings = {
  fontSize: 0,
  contrast: "none",
  accessibleFont: false,
  highlightLinks: false,
  highlightHeadings: false,
};

const HIDDEN_ROUTES = ["/adults", "/kids"];

export default function AccessibilityWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("a11y2");
      if (saved) setS(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const html = document.documentElement;

    // Font size
    html.style.fontSize = s.fontSize > 0 ? `${s.fontSize}%` : "";

    // Contrast / mono
    html.classList.toggle("a11y-mono",           s.contrast === "mono");
    html.classList.toggle("a11y-contrast-light", s.contrast === "light");
    html.classList.toggle("a11y-contrast-dark",  s.contrast === "dark");

    // Other
    html.classList.toggle("a11y-font",     s.accessibleFont);
    html.classList.toggle("a11y-links",    s.highlightLinks);
    html.classList.toggle("a11y-headings", s.highlightHeadings);

    try { localStorage.setItem("a11y2", JSON.stringify(s)); } catch {}
  }, [s]);

  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null;

  function toggle<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS(prev => ({ ...prev, [key]: prev[key] === value ? DEFAULTS[key] : value }));
  }

  function reset() { setS(DEFAULTS); }

  const isActive = s.fontSize > 0 || s.contrast !== "none" || s.accessibleFont || s.highlightLinks || s.highlightHeadings;

  const ITEMS: { label: string; icon: string; action: () => void; active: boolean }[] = [
    { label: "מונוכרום",        icon: "◑", action: () => toggle("contrast", "mono"),  active: s.contrast === "mono"  },
    { label: "ניגודיות בהירה", icon: "○", action: () => toggle("contrast", "light"), active: s.contrast === "light" },
    { label: "ניגודיות כהה",   icon: "●", action: () => toggle("contrast", "dark"),  active: s.contrast === "dark"  },
    { label: "גופן 155%",      icon: "⊕", action: () => toggle("fontSize", 155),     active: s.fontSize === 155     },
    { label: "גופן 175%",      icon: "⊕", action: () => toggle("fontSize", 175),     active: s.fontSize === 175     },
    { label: "גופן 200%",      icon: "⊕", action: () => toggle("fontSize", 200),     active: s.fontSize === 200     },
    { label: "פונט נגיש",      icon: "A", action: () => toggle("accessibleFont", true),    active: s.accessibleFont       },
    { label: "הדגשת קישורים",  icon: "🔗", action: () => toggle("highlightLinks", true),   active: s.highlightLinks       },
    { label: "הדגשת כותרות",   icon: "H", action: () => toggle("highlightHeadings", true), active: s.highlightHeadings    },
  ];

  return (
    <>
      <style>{`
        .a11y-mono                    { filter: grayscale(100%) !important; }
        .a11y-contrast-light          { filter: contrast(2) brightness(1.1) !important; }
        .a11y-contrast-dark           { filter: invert(1) hue-rotate(180deg) !important; }
        .a11y-font, .a11y-font *      { font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.04em !important; line-height: 1.6 !important; }
        .a11y-links a                 { text-decoration: underline !important; outline: 2px solid #0055cc !important; outline-offset: 2px !important; border-radius: 2px; }
        .a11y-headings h1, .a11y-headings h2, .a11y-headings h3,
        .a11y-headings h4, .a11y-headings h5, .a11y-headings h6 {
          outline: 2px solid #cc5500 !important; outline-offset: 3px !important;
          background: #fff8e1 !important; border-radius: 3px !important;
        }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="פתח תפריט נגישות"
        aria-expanded={open}
        className="fixed bottom-24 left-0 z-50 w-12 h-12 flex items-center justify-center shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
        style={{ background: "#1565c0", borderRadius: "0 8px 8px 0" }}
      >
        {/* Standard wheelchair accessibility icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26" aria-hidden="true">
          <circle cx="12" cy="4" r="2"/>
          <path d="M19 13h-6l-1-5h4V6h-5.3c-.4 0-.7.2-.9.5L8 9.5V18h2v-4h5l2 4h2l-2.1-4.2A2 2 0 0 0 19 13z"/>
          <path d="M8 19a3 3 0 1 0 6 0"/>
        </svg>
        {isActive && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 border border-white" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="אפשרויות נגישות"
          dir="rtl"
          className="fixed bottom-12 left-14 z-50 rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ background: "#fff", minWidth: "200px", fontFamily: "Heebo, Arial, sans-serif" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: "#1565c0" }}>
            <span className="font-bold text-white text-sm">נגישות</span>
            <button onClick={() => setOpen(false)} aria-label="סגור" className="text-white opacity-70 hover:opacity-100 text-lg leading-none ml-1">✕</button>
          </div>

          {/* Items */}
          <div>
            {ITEMS.map(({ label, icon, action, active }) => (
              <button
                key={label}
                onClick={action}
                aria-pressed={active}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-right transition-colors"
                style={{
                  background: active ? "#e3f2fd" : "white",
                  color: active ? "#1565c0" : "#222",
                  fontWeight: active ? 700 : 400,
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <span className="w-5 text-center text-base opacity-70" aria-hidden="true">{icon}</span>
                <span className="flex-1 text-right">{label}</span>
                {active && <span className="text-blue-600 text-xs font-bold">✓</span>}
              </button>
            ))}

            {/* Reset */}
            <button
              onClick={reset}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ background: isActive ? "#fff3e0" : "#fafafa", color: isActive ? "#e65100" : "#999", borderTop: "1px solid #eee" }}
            >
              <span className="w-5 text-center" aria-hidden="true">↺</span>
              <span className="flex-1 text-right">איפוס כל ההגדרות</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
