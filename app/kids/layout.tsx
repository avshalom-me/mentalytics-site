import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "שאלון הכוונה טיפולית לילדים ונוער",
  description: "שאלון מקצועי לאיתור קשיים רגשיים, התנהגותיים ולמידה אצל ילדים ונוער — עם הפניה למטפל המתאים לפי גיל ואזור.",
};

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
