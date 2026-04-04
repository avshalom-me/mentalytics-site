"use client";

import { useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    console.log("auth/callback - code:", code ? "exists" : "MISSING", "| full search:", window.location.search, "| hash:", window.location.hash);
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        console.log("exchangeCodeForSession - data:", data, "| error:", error);
        if (error) {
          console.error("Exchange failed:", error.message);
          window.location.href = "/therapists/login";
        } else {
          window.location.href = "/therapists/dashboard";
        }
      });
    } else {
      console.log("No code found, redirecting to login");
      window.location.href = "/therapists/login";
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center" dir="rtl">
      <p className="text-stone-500">מתחבר...</p>
    </div>
  );
}
