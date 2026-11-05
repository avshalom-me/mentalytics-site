import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Scoped to app/ on purpose: .next holds generated .js that must never be
    // collected, and the repo has no other test roots yet.
    include: ["app/**/*.test.ts"],
    environment: "node",
    // Several tests read every source file under app/ synchronously (font,
    // snippet markup, route exports). On a busy machine, with other sessions
    // running their own suites, they pass alone in 2 seconds and run past the
    // default 5 seconds in the full run, which aborted pre-push three times on
    // 27/10/2026 for nothing. The ceiling is generous; a real hang still fails.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      // The same "@/..." alias tsconfig gives the app, so a test can import a
      // module that uses it (sumit.ts → "@/app/lib/promo").
      "@": fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, ""),
    },
  },
});
