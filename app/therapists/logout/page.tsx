"use client";

import { useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function LogoutPage() {
  useEffect(() => {
    supabase.auth.signOut().then(() => {
      window.location.href = "/therapists/login";
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center" dir="rtl">
      <p className="text-sm text-stone-500">מתנתק...</p>
    </div>
  );
}
