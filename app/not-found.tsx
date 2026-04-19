import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <Image src="/logo.svg" alt="טיפול חכם" width={64} height={64} className="mx-auto mb-6" />
      <h1 className="text-3xl font-black text-stone-900 mb-3">הדף לא נמצא</h1>
      <p className="text-stone-500 leading-7 mb-8">
        הכתובת שחיפשת אינה קיימת או שהועברה למקום אחר.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)" }}
        >
          חזרה לדף הבית
        </Link>
        <Link
          href="/therapists"
          className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 px-6 py-3 text-sm font-bold text-stone-700 hover:bg-stone-100"
        >
          מאגר המטפלים
        </Link>
      </div>
    </main>
  );
}
