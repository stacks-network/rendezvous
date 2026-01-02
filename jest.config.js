/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.tests.ts"],
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  silent: true,
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 600000, // 10 minutes
  maxWorkers: 1,
  collectCoverage: false,
  collectCoverageFrom: [
    // Include: Main TypeScript source files.
    "*.ts",
    // Exclude: Test files, config files, and generated content.
    "!*.tests.ts",
    "!*.config.ts",
    "!test.utils.ts",
    // Exclude: Directories.
    "!example/**",
    "!node_modules/**",
    "!dist/**",
    "!coverage/**",
  ],
  coverageDirectory: "coverage",
};
