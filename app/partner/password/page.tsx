"use client";

import ChangePassword from "../ChangePassword";

// "שינוי סיסמה" מתפריט הצד של הפורטל. המעטפת (PartnerShell) כבר בדקה שיש סשן
// ושהמשתמשת שותפה פעילה.
export default function PartnerPasswordPage() {
  return <ChangePassword onDone={() => (window.location.href = "/partner/schools/overview")} />;
}
