"use client";

import { useEffect, useState } from "react";
import { setTrackingOptOut } from "@/app/lib/track-optout";

// מצב אדמין בדפדפן הזה.
//
// עד 15/10/2026 זה היה כפתור: לחיצה שמה קוד ב-localStorage, והשאלונים שלחו אותו
// לשרת. דפדפן שלא נלחץ בו, או שנוקה, נתקל שוב ב"נגמרו הניסיונות". עכשיו שער
// האדמין עצמו מסמן כל דפדפן שנכנס אליו (עוגיית צוות, ראו app/lib/staff-cookie.ts),
// והשרת מזהה אותה - אין מה ללחוץ. הרכיב רק מראה את המצב.
//
// הכפתור הישן נשאר כגיבוי: אם העוגייה לא הגיעה (דפדפן שחוסם עוגיות), הוא שם את
// הקוד ב-localStorage כמו קודם.

const STAFF_TOKEN_KEY = "staff_token";
// נרשם כשהמדידה כובתה אוטומטית בפעם הראשונה, כדי שכפתור המדידה ב-/admin/seo יישאר
// הסמכות היחידה להחזיר אותה: בלי הסימון היינו מכבים אותה מחדש בכל כניסה לעמוד.
const SEEN_KEY = "mnt_staff_seen";

type Status = "checking" | "cookie" | "token" | "off";

function storedTokenStatus(): Status {
  try {
    return localStorage.getItem(STAFF_TOKEN_KEY) ? "token" : "off";
  } catch {
    return "off";
  }
}

export default function StaffModeBadge() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage/check?type=adults")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.staff === true) {
          try {
            if (!localStorage.getItem(SEEN_KEY)) {
              // בדיקות הצוות לא נספרות כמבקרים - כמו שהכפתור הישן עשה בלחיצה.
              setTrackingOptOut(true);
              localStorage.setItem(SEEN_KEY, "1");
            }
          } catch {
            /* אחסון חסום - אין מה לסמן */
          }
          setStatus("cookie");
        } else {
          setStatus(storedTokenStatus());
        }
      })
      .catch(() => {
        if (!cancelled) setStatus(storedTokenStatus());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return <span className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-400">בודק מצב אדמין...</span>;
  }

  if (status === "cookie") {
    return (
      <span
        title="הדפדפן הזה נשמר כדפדפן צוות בכל כניסה לאדמין, לשנה מהכניסה האחרונה. השאלונים בו לא מוגבלים ולא נספרים. לבדיקה כמבקר רגיל: חלון גלישה בסתר."
        className="text-xs px-3 py-1.5 rounded-lg border font-medium bg-green-100 text-green-700 border-green-300"
      >
        ✓ מצב אדמין פעיל בדפדפן הזה
      </span>
    );
  }

  const isToken = status === "token";
  return (
    <button
      onClick={async () => {
        if (isToken) {
          localStorage.removeItem(STAFF_TOKEN_KEY);
          window.location.reload();
          return;
        }
        // גיבוי: השרת נותן את הקוד למי שמחובר לאדמין, והוא נשמר בדפדפן ונשלח
        // עם בקשות הניקוד.
        try {
          const res = await fetch("/api/admin-staff-mode", { method: "POST" });
          const j = await res.json();
          if (!res.ok || !j.ok || typeof j.token !== "string") {
            window.alert(j.error || "לא ניתן להפעיל מצב אדמין");
            return;
          }
          localStorage.setItem(STAFF_TOKEN_KEY, j.token);
          setTrackingOptOut(true);
          window.location.reload();
        } catch {
          window.alert("לא ניתן להפעיל מצב אדמין");
        }
      }}
      title={isToken ? "כיבוי: השאלונים בדפדפן הזה חוזרים להגבלת הניסיונות" : "השאלונים בדפדפן הזה לא יוגבלו ולא ייספרו, וגם המדידה תכובה בו"}
      className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${isToken ? "bg-green-100 text-green-700 border-green-300" : "bg-stone-100 text-stone-600 border-stone-300"}`}
    >
      {isToken ? "✓ מצב אדמין פעיל (ללא הגבלת שאלון)" : "הפעל מצב אדמין"}
    </button>
  );
}
