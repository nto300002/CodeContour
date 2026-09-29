import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}", "*.cjs"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
