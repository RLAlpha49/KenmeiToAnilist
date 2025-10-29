#!/usr/bin/env node

/**
 * Build script that loads .env file and then runs electron-forge make
 * This ensures all environment variables are available during the build
 */

require("dotenv").config();

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Set NODE_ENV if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

console.log(`[Build] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Build] SENTRY_DSN configured: ${!!process.env.SENTRY_DSN}`);

// Ensure we run from the project directory (script location)
const projectRoot = path.resolve(__dirname);

// Prefer local binary if available
let command;
let args;

const localBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-forge.cmd" : "electron-forge",
);

if (fs.existsSync(localBin)) {
  command = localBin;
  args = ["make"];
  console.log(`[Build] Using local electron-forge at ${localBin}`);
} else {
  // Fallback to npx so it works even if electron-forge isn't in PATH
  command = process.platform === "win32" ? "npx.cmd" : "npx";
  args = ["electron-forge", "make"];
  console.log("[Build] Local electron-forge not found, falling back to npx");
}

const spawnOptions = {
  stdio: "inherit",
  env: process.env,
  cwd: projectRoot,
};

let result;
if (process.platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
  result = spawnSync("cmd.exe", ["/c", command, ...args], spawnOptions);
} else {
  result = spawnSync(command, args, spawnOptions);
}

if (result && result.error) {
  console.error("[Build] Failed to run electron-forge:", result.error);
  process.exit(1);
}

process.exit(result && typeof result.status === "number" ? result.status : 0);
