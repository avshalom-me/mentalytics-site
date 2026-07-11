import Link from "next/link";

// Conversion CTA for the /research content pages — funnels informational
// readers (incl. paid "how to find a psychologist" traffic) into the matching
// quiz. Server component; inline color:#fff because a global `a` rule overrides
// utility text-color classes on links.
export default function QuizCtaBanner({
  heading = "לא בטוחים איפה להתחיל?",
  sub = "שאלון קצר וחכם יתאים לכם את סוג הטיפול והמטפל/ת המתאימים ביותר לקושי שלכם — בחינם, בלי להתחייב.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <div className="my-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-6 text-center" dir="rtl">
      <h2 className="mb-2 text-xl font-black text-[#2A6462]">{heading}</h2>
      <p className="mx-auto mb-5 max-w-md text-sm leading-6 text-[#3E5250]">{sub}</p>
      <Link
        href="/adults"
        className="inline-block rounded-full bg-[#3D8C8A] px-8 py-3 text-base font-bold transition hover:bg-[#2A6462]"
        style={{ color: "#fff" }}
      >
        למצוא לי מטפל/ת מתאים/ה ←
      </Link>
    </div>
  );
}
