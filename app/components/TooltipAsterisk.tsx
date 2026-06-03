"use client";
import { useState, useRef, useEffect } from "react";

export default function TooltipAsterisk() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <sup
        onClick={() => setOpen(v => !v)}
        style={{
          cursor: "pointer",
          color: "var(--teal)",
          fontWeight: 700,
          fontSize: "10px",
          lineHeight: 1,
          userSelect: "none",
          marginInlineStart: "1px",
        }}
      >
        *
      </sup>
      {open && (
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--text)",
          color: "white",
          fontSize: "12px",
          lineHeight: 1.5,
          padding: "7px 12px",
          borderRadius: "8px",
          whiteSpace: "nowrap",
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
          pointerEvents: "none",
        }}>
          בשימוש הוגן. עד 6 שימושים לכל שאלון
        </span>
      )}
    </span>
  );
}
