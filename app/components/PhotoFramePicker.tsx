"use client";

import { useRef, useState } from "react";
import {
  focusAfterDrag,
  photoObjectPosition,
  photoShape,
  resolvedFocus,
  type PhotoShape,
} from "@/app/lib/photo-focus";

// The square a profile photo is cut to, shown BEFORE it is saved, with the
// photo draggable inside it. The server cuts exactly this square
// (profile-photo.ts, same arithmetic in photo-focus.ts). Until 21/10/2026 the
// form showed a CSS center crop while the server cut near the top, and a
// therapist whose face sat low in a tall photo was saved with only the upper
// half of her face.

const STEP = 0.08;

export default function PhotoFramePicker({
  src,
  focus,
  onChange,
  size = 168,
  readOnly = false,
}: {
  /** Object URL of the chosen file. */
  src: string;
  /** null = not moved yet (the server default applies, and is what is shown). */
  focus: number | null;
  onChange: (focus: number) => void;
  size?: number;
  /** The photo was already uploaded: show the saved square, without controls. */
  readOnly?: boolean;
}) {
  // Measured per src, so choosing another file never shows the previous file's
  // shape. The picker only renders after a file is chosen (client-side), so
  // onLoad always fires.
  const [loaded, setLoaded] = useState<{ src: string; w: number; h: number } | null>(null);
  const dims = loaded && loaded.src === src ? loaded : null;
  const drag = useRef<{ x: number; y: number; focus: number } | null>(null);

  const shape: PhotoShape | null = dims ? photoShape(dims.w, dims.h) : null;
  const movable = !readOnly && (shape === "portrait" || shape === "landscape");
  const current = shape ? resolvedFocus(shape, focus) : 0.5;

  function nudge(delta: number) {
    onChange(Math.min(1, Math.max(0, Math.round((current + delta) * 100) / 100)));
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-end gap-3">
        <div
          role="img"
          aria-label="כך תופיע התמונה באתר"
          className="relative shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"
          style={{
            width: size,
            height: size,
            cursor: movable ? "grab" : "default",
            touchAction: movable ? "none" : "auto",
          }}
          onPointerDown={(e) => {
            if (!movable) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, focus: current };
          }}
          onPointerMove={(e) => {
            const start = drag.current;
            if (!start || !dims || !shape) return;
            const delta = shape === "portrait" ? e.clientY - start.y : e.clientX - start.x;
            onChange(focusAfterDrag(start.focus, delta, size, dims.w, dims.h));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setLoaded({ src, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="pointer-events-none block h-full w-full select-none object-cover"
            style={{ objectPosition: shape ? photoObjectPosition(shape, focus) : "50% 50%" }}
          />
        </div>

        {movable && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => nudge(-STEP)}
              disabled={current <= 0}
              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {shape === "portrait" ? "▲ יותר מלמעלה" : "◀ יותר משמאל"}
            </button>
            <button
              type="button"
              onClick={() => nudge(STEP)}
              disabled={current >= 1}
              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {shape === "portrait" ? "▼ יותר מלמטה" : "▶ יותר מימין"}
            </button>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-stone-500">
        {readOnly
          ? "כך התמונה נשמרה."
          : movable
          ? "כך התמונה תופיע באתר. אם הפנים לא במרכז, אפשר לגרור את התמונה בתוך המסגרת או להשתמש בכפתורים. המיקום נשמר יחד עם התמונה."
          : "כך התמונה תופיע באתר."}
      </p>
    </div>
  );
}
