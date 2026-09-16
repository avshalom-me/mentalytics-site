import Link from "next/link";
import { ONLINE_SLUG } from "@/app/lib/regions";

// מוצג רק למבקר ממומן (html.mnt-paid, ראו app/lib/paid-visitor.ts) ורק כשכל
// הכרטיסים ברשימה הם של חינמיים - כלומר אחרי ההסתרה לא נשאר לו מה לראות
// מתחת לכותרת. לכל גולש אחר האלמנט לא קיים על המסך, וגם לא ב-DOM כשיש
// בעמוד לפחות מקודם אחד.
export default function PaidVisitorNotice({ rows }: { rows: ReadonlyArray<{ free?: boolean }> }) {
  if (rows.length === 0 || !rows.every((r) => r.free === true)) return null;
  return (
    <div className="mnt-paid-only rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600 mb-8">
      עדיין אין כאן מטפלים מוצגים. אפשר לבחור{" "}
      <Link href={`/therapists/region/${ONLINE_SLUG}`} className="font-semibold text-[#2e7d8c] hover:underline">טיפול אונליין</Link>
      {" "}או למלא{" "}
      <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
    </div>
  );
}
