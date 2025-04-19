#!/usr/bin/env node

/**
 * Script to check if code coverage meets the desired thresholds.
 * Can be run after generating coverage report.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory name equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Coverage thresholds
const THRESHOLDS = {
  lines: 70,
  functions: 70,
  branches: 60,
  statements: 70,
};

// File path (will be in project root after coverage is generated)
const coverageFile = path.resolve(__dirname, "./coverage/coverage-final.json");

// Check if coverage file exists
if (!fs.existsSync(coverageFile)) {
  console.error(
    '❌ Coverage file not found. Run "npm run test:coverage" first.',
  );
  // Use ESM compatible process object through import.meta
  globalThis.process.exit(1);
}

try {
  // Read and parse coverage data
  const coverageData = JSON.parse(fs.readFileSync(coverageFile, "utf8"));

  // Calculate total coverage
  const totals = {
    lines: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
  };

  // Aggregate coverage data from all files
  Object.values(coverageData).forEach((fileData) => {
    // Lines
    totals.lines.total += Object.keys(fileData.statementMap).length;
    totals.lines.covered += Object.values(fileData.s).filter(
      (v) => v > 0,
    ).length;

    // Functions
    totals.functions.total += Object.keys(fileData.fnMap).length;
    totals.functions.covered += Object.values(fileData.f).filter(
      (v) => v > 0,
    ).length;

    // Branches
    totals.branches.total += Object.values(fileData.branchMap).reduce(
      (acc, branch) => acc + branch.locations.length,
      0,
    );
    totals.branches.covered += Object.entries(fileData.b).reduce(
      (acc, [, hits]) => acc + hits.filter((h) => h > 0).length,
      0,
    );

    // Statements
    totals.statements.total += Object.keys(fileData.statementMap).length;
    totals.statements.covered += Object.values(fileData.s).filter(
      (v) => v > 0,
    ).length;
  });

  // Calculate percentages and check against thresholds
  const results = {};
  let allPassed = true;

  Object.entries(totals).forEach(([key, { total, covered }]) => {
    if (total === 0) {
      results[key] = { percentage: 100, passed: true }; // If no items, consider it 100%
    } else {
      const percentage = Math.round((covered / total) * 100);
      const passed = percentage >= THRESHOLDS[key];
      results[key] = { percentage, passed };
      if (!passed) allPassed = false;
    }
  });

  // Display results
  console.log("\n📊 COVERAGE RESULTS:\n");

  Object.entries(results).forEach(([key, { percentage, passed }]) => {
    const icon = passed ? "✅" : "❌";
    const color = passed ? "\x1b[32m" : "\x1b[31m"; // Green or red
    console.log(
      `${icon} ${color}${key.charAt(0).toUpperCase() + key.slice(1)}: ${percentage}% ${passed ? "PASSED" : `FAILED (threshold: ${THRESHOLDS[key]}%)`}\x1b[0m`,
    );
  });

  console.log("\n");

  if (allPassed) {
    console.log("\x1b[32m✅ All coverage thresholds passed!\x1b[0m\n");
    globalThis.process.exit(0);
  } else {
    console.log(
      "\x1b[31m❌ Some coverage thresholds failed. See above for details.\x1b[0m\n",
    );
    globalThis.process.exit(1);
  }
} catch (error) {
  console.error("❌ Error checking coverage:", error.message);
  globalThis.process.exit(1);
}
