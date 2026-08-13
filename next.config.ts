import type { NextConfig } from "next";

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
