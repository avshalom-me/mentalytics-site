"use client";

import { useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    const hasHashToken = window.location.hash.includes("access_token");

    if (code) {
      // PKCE flow
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          window.location.href = "/therapists/login";
        } else {
          window.location.href = "/therapists/dashboard";
        }
      });
    } else if (hasHashToken) {
      // Implicit flow — Supabase processes hash automatically, just wait for session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          window.location.href = "/therapists/dashboard";
        } else {
          // Give Supabase a moment to process the hash
          setTimeout(async () => {
            const { data: { session: s } } = await supabase.auth.getSession();
            window.location.href = s ? "/therapists/dashboard" : "/therapists/login";
          }, 1000);
        }
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
