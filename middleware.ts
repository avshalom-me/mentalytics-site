import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Constant-time equality so a network observer can't extract the secret
// character-by-character via response-time analysis.
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // Length comparison itself is fine to leak; we only need to hide the
  // per-byte comparison. timingSafeEqual requires equal-length buffers.
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_PASSWORD) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  const base64 = authHeader.slice(6);
  let decoded: string;
  try {
    decoded = Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return false;
  }

  // Split on first colon only — password may contain colons.
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const username = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);

  // Evaluate both checks regardless of the first result so the response
  // time doesn't reveal which one failed.
  const userOk = safeEqual(username, ADMIN_USERNAME);
  const passOk = safeEqual(password, ADMIN_PASSWORD);
  return userOk && passOk;
}

export function middleware(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin-therapists/:path*",
    "/api/admin-stats/:path*",
    "/api/admin-analytics/:path*",
    "/api/admin-weekly-reports/:path*",
    "/api/admin-trigger-weekly-report/:path*",
    "/api/admin-monthly-reports/:path*",
    "/api/admin-trigger-monthly-report/:path*",
  ],
};
