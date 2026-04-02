"use client";

import { useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        window.location.href = "/therapists/dashboard";
      });
    } else {
      window.location.href = "/therapists/login";
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center" dir="rtl">
      <p className="text-stone-500">מתחבר...</p>
    </div>
  );
}
