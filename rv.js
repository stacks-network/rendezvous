#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

const tsconfigPath = path.join(__dirname, "tsconfig.json");
const appPath = path.join(__dirname, "app.js");

console.log("Compiling TypeScript files...");
try {
  execSync(`npx tsc --project ${tsconfigPath}`, { stdio: "inherit" });

  console.log("Compilation successful. Starting fuzzing process...");
  execSync(`node ${appPath} ${process.argv.slice(2).join(" ")}`, {
    stdio: "inherit",
  });
} catch (error) {
  console.error(
    "TypeScript compilation failed, please check the errors above."
  );
  process.exit(1);
}
