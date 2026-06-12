import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["*.tests.ts"],
    setupFiles: ["./vitest.setup.ts"],
    silent: true,
    testTimeout: 600_000, // 10 minutes
    // Run test files serially (not in parallel). The tests share the Clarinet
    // simnet/deployment cache under `example/`, so this mirrors the previous
    // Jest `maxWorkers: 1`.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["*.ts"],
      exclude: [
        "*.tests.ts",
        "*.config.ts",
        "test.utils.ts",
        "example/**",
        "node_modules/**",
        "dist/**",
        "coverage/**",
      ],
    },
  },
});
