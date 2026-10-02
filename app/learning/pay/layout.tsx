import type { Metadata } from "next";

// עמוד ההרשמה לתשלום הוא רכיב לקוח, ולכן הכותרת וה-landmark יושבים כאן.
export const metadata: Metadata = {
  title: "הרשמה לתשלום | מענה לימודי",
  robots: { index: false, follow: false },
};

export default function TeacherPayLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
