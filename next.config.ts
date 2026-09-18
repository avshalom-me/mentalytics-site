import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// ── Questionnaire version stamp ──────────────────────────────────────────────
// Every recorded questionnaire result carries the version of the instrument
// that produced it, because the instrument keeps changing: thresholds moved, the
// couples block went from 21 items to 12, the ADHD cut-off from 4 to 3, a blank
// answer started to mean "absent". Pooling results across those versions without
// a stamp mixes different instruments, and nothing in the data would show it.
//
// A content hash rather than a constant someone bumps by hand, deliberately:
// QUESTIONNAIRE_ITEMS_VERSION asks to be bumped "in the same commit as any
// change", and it sat at 2026-08-13 through a month of changes. A hash of the
// files that define the instrument changes exactly when they do and needs no
// one to remember. To read a hash back: walk `git log` for these paths and hash
// each revision the same way.
//
// Only the scoring and flow-LOGIC files go in. The two big screen files are left
// out on purpose - they change for layout reasons weekly and would split the
// data into versions that are not versions. A flow change made only there is
// still locatable through the commit stamp recorded next to the hash.
const QUIZ_INSTRUMENT_FILES = [
  "app/lib/questionnaire-score.ts",
  "app/lib/questionnaire-items.server.ts",
  "app/lib/kids-score.server.ts",
  "app/lib/kids-recommendations.ts",
  "app/kids/quiz-logic.ts",
];

function quizAlgoVersion(): string {
  const hash = createHash("sha256");
  for (const file of QUIZ_INSTRUMENT_FILES) {
    try {
      // CRLF -> LF so a Windows checkout and the Linux build hash identically;
      // otherwise a hash computed locally could never be matched to production.
      hash.update(readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n"));
    } catch {
      hash.update(`missing:${file}`);
    }
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 10);
}

// Allow next/image to optimize the external images we actually use: Unsplash
// (research/article hero images) and Supabase Storage signed URLs (therapist
// photos / certificates). Host is derived from env so it tracks the project.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "images.unsplash.com" },
];
if (supabaseHost) {
  remotePatterns.push({ protocol: "https", hostname: supabaseHost });
}

// Baseline security headers. Deliberately NO Content-Security-Policy yet — a
// strict CSP needs an allowlist for the Sumit payments SDK, Google Analytics/
// gtag, Vercel Analytics and inline JSON-LD, and must be tested against the live
// payment flow before it ships (a wrong CSP silently breaks card tokenization).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Parallel Claude/dev sessions share this folder, and .next is stateful:
  // a build while another session's dev server runs reuses that server's
  // turbopack cache (stale modules in the output) and can corrupt it right
  // back. Sessions that need their own build set NEXT_DIST_DIR to an
  // isolated directory; default behaviour is unchanged.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Inlined at build time, server and client alike. The server's copy is the one
  // that matters for scoring (the score APIs return it); the client's says which
  // bundle asked the questions - the two differ when a cached bundle talks to a
  // newer server, and a record where they differ is a mixed-version record.
  env: {
    NEXT_PUBLIC_QUIZ_ALGO_VERSION: quizAlgoVersion(),
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },
  images: { remotePatterns },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        // The disabled-child track was withdrawn on 6/8/2026. It was live,
        // in the sitemap, and had been submitted for indexing two days
        // earlier, so the URL is out there - a permanent redirect to the hub
        // sends anyone who arrives (and any equity the URL earned) to the
        // closest relevant page instead of a dead end.
        source: "/research/btl/disabled-child",
        destination: "/research/btl",
        permanent: true,
      },
      {
        // Same day, same reasoning: the youth online page was withdrawn. It
        // goes to the online hub, which still lists every therapist that page
        // filtered. Encoded because a redirect destination is an HTTP header
        // and Hebrew there throws ERR_INVALID_CHAR.
        source: "/therapists/online/:path(%D7%A4%D7%A1%D7%99%D7%9B%D7%95%D7%9C%D7%95%D7%92-%D7%9C%D7%A0%D7%95%D7%A2%D7%A8)",
        destination: "/therapists/region/%D7%90%D7%95%D7%A0%D7%9C%D7%99%D7%99%D7%9F",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
