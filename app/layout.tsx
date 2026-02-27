import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Heebo } from "next/font/google";
import { User, GraduationCap } from "lucide-react";

const heebo = Heebo({
  subsets: ["hebrew"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mentalytics",
  description: "מערכת אבחון והכוונה טיפולית באמצעות שאלונים מודולריים",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="text-sm text-stone-700 hover:text-stone-900 hover:underline" href={href}>
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} min-h-screen bg-[#FAF7F2] text-stone-900`}>
        <header className="sticky top-0 z-50 border-b border-[#E8E1D8] bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-bold tracking-tight text-stone-900">
              Mentalytics
            </Link>

            <nav className="flex items-center gap-4">
              <NavLink href="/about">אודות</NavLink>
              <NavLink href="/research">מאמרים</NavLink>
              <NavLink href="/kids">ילדים</NavLink>
              <NavLink href="/adults">מבוגרים</NavLink>
              <NavLink href="/therapists">מטפלים</NavLink>

              <div className="flex items-center gap-2">
  <Link
    href="/adults"
    className="inline-flex items-center gap-2 rounded-xl bg-[#C96B55] px-3 py-2 text-sm font-semibold text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#C96B55]/40"
  >
    <User size={16} />
    שאלון למבוגרים
  </Link>

  <Link
    href="/kids"
    className="inline-flex items-center gap-2 rounded-xl bg-[#6F8F7A] px-3 py-2 text-sm font-semibold text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#6F8F7A]/40"
  >
    <GraduationCap size={16} />
    שאלון לילדים/נוער
  </Link>
</div>
            </nav>
          </div>
        </header>

        <div>{children}</div>

        <footer className="mt-16 border-t border-[#E8E1D8] bg-white">
          <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-stone-500">
            © {new Date().getFullYear()} Mentalytics
          </div>
        </footer>
      </body>
    </html>
  );
}