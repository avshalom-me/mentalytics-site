import SchoolsShell from "./SchoolsShell";

// ה-CRM המשותף של ענף בתי הספר, צד הבעלים: מסך נפרד מהאדמין הראשי, עם תפריט
// הצד של הענף (כמו שהשותפה רואה ב-/partner) וקישור חזרה ל-CRM הראשי. האדמין
// הראשי לא מציג כאן את התפריט שלו (app/admin/layout.tsx).
export default function SchoolsAdminLayout({ children }: { children: React.ReactNode }) {
  return <SchoolsShell mode="admin">{children}</SchoolsShell>;
}
