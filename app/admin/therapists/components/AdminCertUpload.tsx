"use client";

import { useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { readFileBytes } from "@/app/lib/cert-upload-client";

export type AdminUploadedCert = {
  id: string;
  original_name: string;
  content_type: string;
  signed_url: string | null;
};

const TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

// צירוף תעודה בשם המטפל/ת - לקובץ ששלחו אלינו במייל או בוואטסאפ, אחרי
// שההעלאה מהטלפון שלהם נכשלה (29/9/2026: שישה ניסיונות, והקובץ לא יצא
// מהמכשיר). קובץ נפרד מ-page.tsx בכוונה: קומפוננטה שמוגדרת בתוך הדף
// נבנית מחדש בכל רינדור ומאבדת את המצב שלה.
export default function AdminCertUpload({
  therapistId,
  onUploaded,
}: {
  therapistId: string;
  onUploaded: (cert: AdminUploadedCert) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const contentType = file.type || TYPE_BY_EXT[ext] || "";
      const bytes = await readFileBytes(file);
      if (!bytes) throw new Error("הקובץ לא נקרא מהמחשב. שמרו אותו מקומית ונסו שוב.");

      const call = async (body: Record<string, unknown>) => {
        const res = await fetch("/api/admin-therapist-cert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ therapistId, ...body }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || `שגיאה (${res.status})`);
        return json;
      };

      const sign = await call({ action: "sign", ext, contentType, size: bytes.byteLength });
      const { error: upErr } = await supabase.storage
        .from("therapist-certificates")
        .uploadToSignedUrl(sign.path, sign.token, new Blob([bytes], { type: contentType }), {
          contentType: contentType || undefined,
        });
      if (upErr) throw new Error(`העלאת הקובץ נכשלה: ${upErr.message}`);

      const commit = await call({ action: "commit", path: sign.path, name: file.name, contentType, size: bytes.byteLength });
      onUploaded(commit.certificate as AdminUploadedCert);
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאה נכשלה");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label
        className={`cursor-pointer rounded-full border border-[#2e7d8c] bg-white px-3 py-1.5 text-xs font-semibold text-[#2e7d8c] hover:bg-[#2e7d8c] hover:text-white ${busy ? "pointer-events-none opacity-50" : ""}`}
        title="לקובץ שהמטפל/ת שלח/ה במייל או בוואטסאפ"
      >
        {busy ? "מעלה..." : "📎 צירוף תעודה בשם המטפל/ת"}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </label>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}
