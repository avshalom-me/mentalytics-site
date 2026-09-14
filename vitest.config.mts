import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Scoped to app/ on purpose: .next holds generated .js that must never be
    // collected, and the repo has no other test roots yet.
    include: ["app/**/*.test.ts"],
    environment: "node",
  },
});
