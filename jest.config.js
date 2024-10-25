/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.tests.ts"],
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
};
