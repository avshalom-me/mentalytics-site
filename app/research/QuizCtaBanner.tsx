import Link from "next/link";

// Conversion CTA for the /research content pages - funnels informational
// readers (incl. paid "how to find a psychologist" traffic) into the matching
// quiz. Server component; inline color:#fff because a global `a` rule overrides
// utility text-color classes on links.
//
// Two destinations, not one: a parent reading about a child's difficulty was
// previously offered only the adult questionnaire, which is the wrong form and
// reads as "this site isn't for me". The reassurance line is stated because the
// three things people hesitate over here - cost, exposure, and commitment - are
// exactly the three the questionnaire does not ask for.
export default function QuizCtaBanner({
  heading = "לא בטוחים איפה להתחיל?",
  sub = "שאלון קצר וחכם יתאים לכם את סוג הטיפול והמטפל/ת המתאימים ביותר לקושי שלכם.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <div className="my-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-6 text-center" dir="rtl">
      <h2 className="mb-2 text-xl font-black text-[#2A6462]">{heading}</h2>
      <p className="mx-auto mb-5 max-w-md text-sm leading-6 text-[#3E5250]">{sub}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/adults"
          className="inline-block rounded-full bg-[#3D8C8A] px-7 py-3 text-base font-bold transition hover:bg-[#2A6462]"
          style={{ color: "#fff" }}
        >
          לשאלון למבוגרים ←
        </Link>
        <Link
          href="/kids"
          className="inline-block rounded-full px-7 py-3 text-base font-bold transition hover:bg-[#C2DFDE]"
          style={{ background: "#fff", color: "#2A6462", border: "1px solid #C2DFDE" }}
        >
          לשאלון לילדים ונוער ←
        </Link>
      </div>
      <p className="mt-4 text-xs font-semibold text-[#3D8C8A]">בחינם · אנונימי · ללא התחייבות</p>
    </div>
  );
}
