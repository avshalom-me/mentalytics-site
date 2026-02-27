import Link from "next/link";
import { ClipboardList, BadgeCheck, Image as ImageIcon, FileText } from "lucide-react";

export default function TherapistsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-[28px] border border-[#E8E1D8] bg-white p-8 shadow-[0_10px_24px_rgba(20,20,20,.06)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#6F8F7A]/14 px-3 py-1 text-xs font-semibold text-[#3F5E4A]">
          <BadgeCheck size={14} />
          אזור המטפלים
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900">
          קישור לשאלון המטפלים
        </h1>

        <div className="mt-4 rounded-3xl border border-[#E8E1D8] bg-[#FAF7F2] p-6">
          <p className="font-semibold text-stone-900">מטפל/ת יקר/ה,</p>

          <p className="mt-2 text-stone-700 leading-7">
            בשאלון זה יש להכניס את הפרטים שלך בכדי שנוכל למצוא עבורך את ההתאמות המדוייקות
            ביותר.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E8E1D8] bg-white p-4">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <FileText size={18} className="text-[#C96B55]" />
                תעודות מקצועיות
              </div>
              <p className="mt-2 text-sm text-stone-700 leading-6">
                יש להכין את התעודות המקצועיות שלך (למשל: תואר, רישיון, הסמכות).
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E1D8] bg-white p-4">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <ImageIcon size={18} className="text-[#6F8F7A]" />
                תמונה מומלצת
              </div>
              <p className="mt-2 text-sm text-stone-700 leading-6">
                מומלץ מאוד להכין תמונה מקצועית (לא חובה, אבל משפר משמעותית את הכרטיס).
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/therapists/signup"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#C96B55] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
            >
              <ClipboardList size={16} />
              מעבר לשאלון המטפלים
            </Link>
          </div>
        </div>

        <p className="mt-4 text-xs text-stone-600">
          לאחר מילוי השאלון, הפרטים ישמרו במערכת לצורך התאמה טובה יותר למטופלים.
        </p>
      </div>
    </main>
  );
}