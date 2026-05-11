import { NextResponse } from "next/server";

// Expose Sumit's *public* credentials to the browser so the checkout page
// can tokenize cards directly against api.sumit.co.il. The private APIKey
// stays server-side. Routed instead of NEXT_PUBLIC_ env vars so the values
// have a single source of truth (the server env).
export async function GET() {
  const companyId = process.env.SUMIT_COMPANY_ID;
  const publicKey = process.env.SUMIT_API_PUBLIC_KEY;

  if (!companyId || !publicKey) {
    return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  }

  return NextResponse.json({
    companyId: parseInt(companyId, 10),
    publicKey,
  });
}
