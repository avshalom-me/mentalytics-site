"use client";

import { useEffect, useId, useMemo, type ReactNode } from "react";

// בחירת קובץ בטופס המורים (תעודה, תמונה). הרכיב הקודם היה שדה הקובץ הרגיל של
// הדפדפן, קטן וכמעט בלי טקסט, ולא היה ברור שהוא פותח הוספת תמונה או תעודה
// (הערת הבעלים, 1/11/2026). כאן: כפתור גדול עם הפעולה כתובה עליו, ואחרי
// הבחירה כרטיס עם שם הקובץ (ותצוגה מקדימה לתמונה), עם החלפה והסרה.
//
// onChange מקבל את הקובץ שנבחר, או null בהסרה. בעריכת פרופיל קיים (existing)
// הקובץ מועלה מיד עם הבחירה, ולכן שם file נשאר null והרכיב מציג רק אם כבר
// קיים קובץ שמור.

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const ICON = {
  photo: (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1.2-1.8A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.2L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  ),
  doc: (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  ),
};

export default function FilePickButton({
  title,
  addLabel,
  changeLabel,
  accept,
  icon,
  hint,
  required,
  file,
  existing,
  existingText,
  missingText,
  disabled,
  preview,
  onChange,
}: {
  /** מעל הכפתור: מה זה ולמה (למשל "תמונה (מוצגת להורים)"). */
  title: ReactNode;
  addLabel: string;
  changeLabel: string;
  accept: string;
  icon: "photo" | "doc";
  hint?: string;
  required?: boolean;
  file: File | null;
  /** כבר שמור בשרת (עריכת פרופיל). */
  existing?: boolean;
  existingText?: string;
  /** חסר ונדרש (עריכת פרופיל): מוצג באזהרה. */
  missingText?: string;
  disabled?: boolean;
  preview?: boolean;
  onChange: (f: File | null) => void;
}) {
  const id = useId();
  const url = useMemo(() => (preview && file ? URL.createObjectURL(file) : null), [preview, file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const has = !!file || !!existing;

  return (
    <div>
      <div className="mb-2 text-base font-bold text-[var(--text-2)]">
        {title}
        {required && <span className="text-[var(--text-2)]"> *</span>}
      </div>

      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          // כך אפשר לבחור שוב את אותו קובץ אחרי הסרה.
          e.target.value = "";
          if (f) onChange(f);
        }}
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-[var(--teal)] bg-[var(--teal-pale)] p-3" role="status">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה מקומית (blob), לא תמונה מהשרת
            <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--teal-dark)]">{ICON[icon]}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-base font-black text-[var(--teal-dark)]">
              <span aria-hidden="true">✓</span> נבחר
            </div>
            <div className="truncate text-base text-[var(--text-2)]" dir="ltr" style={{ textAlign: "start" }}>{file.name}</div>
            <div className="text-sm text-[var(--muted)]">{sizeLabel(file.size)}</div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row">
            <label
              htmlFor={id}
              className="cursor-pointer rounded-full border border-[var(--teal)] bg-white px-4 py-2 text-center text-sm font-bold text-[var(--teal-dark)] peer-focus-visible:ring-2"
            >
              החלפה
            </label>
            <button type="button" onClick={() => onChange(null)} disabled={disabled} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--text-2)]">
              הסרה
            </button>
          </div>
        </div>
      ) : (
        <>
          {existing && (
            <p className="mb-2 flex items-center gap-1.5 text-base font-bold text-emerald-700">
              <span aria-hidden="true">✓</span> {existingText ?? "קיים"}
            </p>
          )}
          {!existing && missingText && <p className="mb-2 text-base font-bold text-amber-700">{missingText}</p>}
          <label
            htmlFor={id}
            className={`flex min-h-[64px] items-center justify-center gap-3 rounded-2xl border-2 border-[var(--teal)] px-5 py-4 text-lg font-black text-[var(--teal-dark)] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--teal)] peer-focus-visible:ring-offset-2 ${
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--teal-pale)]"
            } ${has ? "bg-white" : "bg-[var(--teal-pale)]"}`}
          >
            {ICON[icon]}
            <span>{has ? changeLabel : addLabel}</span>
            <span aria-hidden="true" className="text-2xl leading-none">+</span>
          </label>
        </>
      )}

      {hint && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
