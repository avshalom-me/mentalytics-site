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
  poweredByHeader: false,
  images: { remotePatterns },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
