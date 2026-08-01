import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "שאלון הכוונה טיפולית לילדים ונוער",
  description: "שאלון מקצועי לאיתור קשיים רגשיים, התנהגותיים ולמידה אצל ילדים ונוער - עם הפניה למטפל המתאים לפי גיל ואזור.",
  // The quiz funnel itself stays out of the index (it is an interactive flow,
  // not a landing page), but "follow" so the authority it receives keeps
  // flowing on to /therapists and the topic pages it links to. It is also kept
  // out of the sitemap - listing a noindex URL there only earns a "submitted
  // URL marked noindex" warning in Search Console.
  robots: { index: false, follow: true },
};

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
