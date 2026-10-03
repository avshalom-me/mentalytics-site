import type { Metadata } from "next";

// "לימוד חכם" - אזור המורים, תחת /learning.
//
// ברירת המחדל של האזור היא noindex: הפרופיל והתשלום של המורה, הקישור האישי
// ועמודי הפרופיל של המורים אינם עמודים לחיפוש. שני עמודים מחליפים אותה
// בעצמם, דרך learningRobots(): הדלת להורים (/learning) וההצטרפות למורים
// (/learning/join) - לפי החלטת הבעלים מ-3/10/2026, ורק כשהמתג
// LEARNING_DOOR_PUBLIC דלוק (app/lib/learning-door.ts).
//
// עמוד חדש באזור יורש noindex. זה הכיוון הבטוח: כדי להיפתח לגוגל עמוד צריך
// לבקש זאת, ולא לזכור להיסגר.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
