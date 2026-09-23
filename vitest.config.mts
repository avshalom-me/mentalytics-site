import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Scoped to app/ on purpose: .next holds generated .js that must never be
    // collected, and the repo has no other test roots yet.
    include: ["app/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // The same "@/..." alias tsconfig gives the app, so a test can import a
      // module that uses it (sumit.ts → "@/app/lib/promo").
      "@": fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, ""),
    },
  },
});
