import LearningShell from "./LearningShell";

// ענף לימוד חכם (המורים) באדמין: מסך נפרד מהאדמין הראשי, עם תפריט צד של
// הענף וקישור חזרה, באותו פורמט כמו ה-CRM של ענף בתי הספר. האדמין הראשי
// לא מציג כאן את התפריט שלו (app/admin/layout.tsx).
export default function LearningAdminLayout({ children }: { children: React.ReactNode }) {
  return <LearningShell>{children}</LearningShell>;
}
