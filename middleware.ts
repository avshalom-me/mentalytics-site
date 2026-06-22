import { NextRequest, NextResponse } from "next/server";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Constant-time string equality, written in pure JS because Next.js
// middleware runs in the Edge Runtime, where Node's `crypto.timingSafeEqual`
// is not available. XORing every byte and OR-accumulating the result
// means the loop always touches the same number of characters regardless
// of where the first mismatch sits.
function safeEqual(a: string, b: string): boolean {
  // Length comparison itself is fine to leak; what we hide is the
  // per-byte mismatch position once lengths match.
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_PASSWORD) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  const base64 = authHeader.slice(6);
  let decoded: string;
  try {
    decoded = atob(base64);
  } catch {
    return false;
  }

  // Split on first colon only — passwords may contain colons.
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const username = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);

  // Evaluate both checks regardless of the first result so response time
  // doesn't reveal which one failed.
  const userOk = safeEqual(username, ADMIN_USERNAME);
  const passOk = safeEqual(password, ADMIN_PASSWORD);
  return userOk && passOk;
}

// What counts as an admin surface. Done in code (not the matcher) because
// path-to-regexp can't reliably match a hyphenated prefix within a segment
// like `/api/admin-*`. A plain string prefix check is unambiguous and fails
// safe: every current AND future `/admin/*` page or `/api/admin-*` route is
// guarded by default, with no per-route matcher line to forget.
function needsAuth(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin-");
}

export function middleware(request: NextRequest) {
  if (!needsAuth(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
  // Broad matcher; the actual admin gate is the needsAuth() prefix check above.
  matcher: ["/admin/:path*", "/api/:path*"],
};
