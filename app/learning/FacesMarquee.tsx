"use client";

import Link from "next/link";
import { useState } from "react";
import "./faces.css";

// פס הפנים של המורים בדף הנחיתה של לימוד חכם, בעקבות הקרוסלה של דף הבית
// של שבילים (altmed-site/app/home/FacesMarquee.tsx): כרטיסי פנים (תמונה 3:4,
// שם, מה מלמד/ת) שנעים לבד בלולאה, נעצרים במעבר עכבר, במיקוד מקלדת ובכפתור
// "השהיה", ומכבדים "פחות תנועה" (faces.css). הרשימה מוכפלת כדי שהלולאה
// תהיה רציפה; העותק השני מוסתר מקוראי מסך ולא ניתן למיקוד.
//
// הכללים (תוכנית השדרוג, 6/11/2026): רק מורים עם תמונה אמיתית, בלי אווטארים;
// הפס מוצג משישה מורים עם תמונה ומעלה (מתחת לזה הפסיפס בפתיחה מספיק);
// לחיצה על כרטיס פותחת את הפרופיל, לא את המאגר.

export const FACES_MIN_TO_SHOW = 6;

export type Face = { id: string; name: string; subjects: string; photo: string; href: string };

export default function FacesMarquee({ faces }: { faces: Face[] }) {
  const [paused, setPaused] = useState(false);
  if (faces.length < FACES_MIN_TO_SHOW) return null;
  return (
    <section className="lc-faces" aria-label="מורים במאגר">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5">
        <h2 className="text-xl font-black sm:text-2xl">המורים במאגר</h2>
        <button type="button" className="lc-faces-toggle" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? "הפעלה" : "השהיה"}
        </button>
      </div>
      <div className="lc-faces-viewport">
        <ul className="lc-faces-track" data-paused={paused ? "true" : "false"} style={{ animationDuration: `${Math.max(36, faces.length * 5)}s` }}>
          {[false, true].map((copy) =>
            faces.map((f) => (
              <li key={`${copy ? "b" : "a"}-${f.id}`} className="lc-face" aria-hidden={copy || undefined}>
                <Link href={f.href} tabIndex={copy ? -1 : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.photo} alt="" loading="lazy" width={220} height={293} />
                  <span className="lc-face-text">
                    <span className="lc-face-name">{f.name}</span>
                    <span className="lc-face-sub">{f.subjects}</span>
                  </span>
                </Link>
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}
