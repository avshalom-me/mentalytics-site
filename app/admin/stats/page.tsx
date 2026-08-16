import { redirect } from "next/navigation";

// עמוד "לחיצות" בוטל (ביקורת 15/8/26): כל המידע שהוצג בו קיים בטאב המשפך
// של האנליטיקה, שם גם עם CTR, מיון ומתג מקור. הכתובת מפנה לשם.
export default function StatsRedirect() {
  redirect("/admin/analytics");
}
