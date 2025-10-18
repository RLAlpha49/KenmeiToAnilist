#!/usr/bin/env node

/**
 * Confidence Calculation Test Utility
 *
 * Test the confidence percentage calculations directly without running the full app.
 *
 * Usage:
 *   npm run test:confidence "Attack on Titan" "Shingeki no Kyojin"
 *   npm run test:confidence "Death Note" "Death Note"
 *   npm run test:confidence "One Piece" "Bleach"
 *
 * With JSON output:
 *   npm run test:confidence "manga" "candidate" --json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for the scoring functions
async function loadScoringFunctions() {
  try {
    // Import from the actual source files
    const { calculateMatchScore } = await import(
      "../src/api/matching/scoring/match-scorer.ts"
    );
    const { calculateConfidence } = await import(
      "../src/api/matching/scoring/confidence-mapper.ts"
    );

    return {
      calculateMatchScore,
      calculateConfidence,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Cannot find module")
    ) {
      console.error(
        "Error: Could not load scoring functions. This script must be run with tsx or from within the project.",
      );
    }
    console.error(
      "Error loading scoring functions. Make sure you have tsx installed:",
    );
    console.error("  npm install -D tsx");
    console.error("\nOr use the compiled version with:");
    console.error("  npm run build");
    throw error;
  }
}

// Fallback: use require for compiled JS
function loadScoringFunctionsFallback() {
  try {
    const distDir = path.resolve(__dirname, "..", "dist");
    if (!fs.existsSync(distDir)) {
      throw new Error("dist directory not found. Run: npm run build");
    }

    // This is a simplified version - actual implementation depends on build output
    console.error(
      "Please compile the project first: npm run build or use: npx tsx scripts/test-confidence.mts",
    );
    process.exit(1);
  } catch (error) {
    console.error("Failed to load scoring functions:", error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(args: string[]) {
  const params = {
    searchTitle: "",
    candidateTitle: "",
    candidateRomaji: "",
    candidateNative: "",
    synonyms: [] as string[],
    json: false,
  };

  let positionalIndex = 0;
  for (const arg of args) {
    if (arg === "--json") {
      params.json = true;
    } else if (arg.startsWith("-s=") || arg.startsWith("--synonyms=")) {
      // Support both -s= and --synonyms= formats
      const prefix = arg.startsWith("-s=") ? "-s=" : "--synonyms=";
      const synonymsStr = arg.substring(prefix.length);
      params.synonyms = synonymsStr.split(",").map((s) => s.trim());
    } else if (!arg.startsWith("-")) {
      if (positionalIndex === 0) {
        params.searchTitle = arg;
      } else if (positionalIndex === 1) {
        params.candidateTitle = arg;
      } else if (positionalIndex === 2) {
        params.candidateRomaji = arg;
      } else if (positionalIndex === 3) {
        params.candidateNative = arg;
      }
      positionalIndex++;
    }
  }

  return params;
}

// Create a mock AniListManga object for testing
function createMockManga(
  englishTitle: string,
  romajiTitle: string,
  nativeTitle: string,
  synonyms: string[],
) {
  return {
    id: 1,
    title: {
      english: englishTitle,
      romaji: romajiTitle,
      native: nativeTitle,
    },
    description: "",
    chapters: 0,
    volumes: 0,
    format: "MANGA",
    status: "FINISHED",
    coverImage: {
      large: "",
      medium: "",
    },
    startDate: { year: 0, month: 0, day: 0 },
    genres: [],
    synonyms,
  };
}

// Helper to print help message
function printHelp(): void {
  console.log(`
Confidence Calculation Test Utility
====================================

Test the confidence percentage calculations for manga matching.

Usage:
  npx tsx scripts/test-confidence.mts <searchTitle> <candidateTitle> [candidateRomaji] [candidateNative] [options]
  npm run test:confidence "Attack on Titan" "Shingeki no Kyojin"

Examples:
  # Exact match (English title)
  npx tsx scripts/test-confidence.mts "Death Note" "Death Note"

  # With romaji (Japanese romanization)
  npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin"

  # With native and romaji (native takes priority)
  npx tsx scripts/test-confidence.mts "進撃の巨人" "The Unparalleled" "進撃の巨人" "進撃の巨人"

  # With synonyms for matching (use single quotes or -s= format for complex args)
  npx tsx scripts/test-confidence.mts "Rank no Ura Soubi" "The Unparalleled" -s="Rank no Ura Soubi,Unparalleled"

  # With JSON output
  npx tsx scripts/test-confidence.mts "Death Note" "Death Note" --json

  # All options combined
  npx tsx scripts/test-confidence.mts "Title JP" "Title EN" "Title Romaji" "ネイティブ" -s="syn1,syn2" --json

Options:
  -s="title1,title2,..." or --synonyms="title1,title2,..."  Comma-separated synonyms
  --json                                                     Output results as JSON
  --help, -h                                                 Show this help message

Note: Use -s= instead of --synonyms= when running via 'npm run' to avoid npm interpreting it as config.
    `);
}

// Helper to print results in JSON format
function printJsonResults(
  searchTitle: string,
  candidateTitle: string,
  candidateRomaji: string,
  candidateNative: string,
  matchScore: number,
  confidence: number,
): void {
  const result = {
    searchTitle,
    candidateTitle,
    candidateRomaji,
    candidateNative,
    matchScore: Number.parseFloat(matchScore.toFixed(4)),
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
  };
  console.log(JSON.stringify(result, null, 2));
}

// Helper to check and format confidence bracket
function formatBracketCheck(
  minConfidence: number,
  maxConfidence: number | null,
  actualConfidence: number,
  description: string,
): string {
  const isInBracket =
    maxConfidence === null
      ? actualConfidence >= minConfidence
      : actualConfidence >= minConfidence && actualConfidence < maxConfidence;

  const rangeText =
    maxConfidence === null
      ? `${minConfidence}+%`
      : `${minConfidence}-${maxConfidence - 1}%`;
  const checkMark = isInBracket ? "✓" : "✗";
  return `  ${rangeText}: ${description} (actual: ${checkMark})`;
}

// Helper to print human-readable results
function printHumanResults(
  searchTitle: string,
  candidateTitle: string,
  candidateRomaji: string,
  candidateNative: string,
  matchScore: number,
  confidence: number,
): void {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║          CONFIDENCE CALCULATION TEST RESULTS               ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  console.log(`Search Title:        ${searchTitle}`);
  console.log(`Candidate Title:     ${candidateTitle}`);
  if (candidateRomaji && candidateRomaji !== candidateTitle) {
    console.log(`Candidate Romaji:    ${candidateRomaji}`);
  }
  if (candidateNative && candidateNative !== candidateTitle) {
    console.log(`Candidate Native:    ${candidateNative}`);
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`Match Score:         ${matchScore.toFixed(4)} (0-1 scale)`);
  console.log(`Confidence:          ${confidence}% (0-100 scale)`);
  console.log(`Confidence Level:    ${getConfidenceLevel(confidence)}`);
  console.log("────────────────────────────────────────────────────────────\n");

  // Show confidence brackets
  console.log("Confidence Brackets:");
  console.log(formatBracketCheck(90, null, confidence, "Near-perfect match"));
  console.log(formatBracketCheck(80, 90, confidence, "Strong match"));
  console.log(formatBracketCheck(65, 80, confidence, "Good match"));
  console.log(formatBracketCheck(50, 65, confidence, "Reasonable match"));
  console.log(formatBracketCheck(30, 50, confidence, "Weak match"));
  console.log(formatBracketCheck(15, 30, confidence, "Very weak match"));
  console.log(formatBracketCheck(1, 15, confidence, "Extremely weak match\n"));
}

// Main test function
async function runTest(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const {
    searchTitle,
    candidateTitle,
    candidateRomaji,
    candidateNative,
    synonyms,
    json,
  } = parseArgs(args);

  if (!searchTitle || !candidateTitle) {
    console.error("Error: Both search title and candidate title are required");
    process.exit(1);
  }

  try {
    // Try to load with tsx first
    const functions = await loadScoringFunctions();
    const { calculateMatchScore, calculateConfidence } = functions;

    // Create mock manga
    const mockManga = createMockManga(
      candidateTitle,
      candidateRomaji || candidateTitle,
      candidateNative,
      synonyms,
    );

    // Calculate match score and confidence
    const matchScore = calculateMatchScore(mockManga, searchTitle);
    const confidence = calculateConfidence(searchTitle, mockManga);

    const romajiForDisplay = candidateRomaji || candidateTitle;
    const nativeForDisplay = candidateNative || candidateTitle;

    if (json) {
      printJsonResults(
        searchTitle,
        candidateTitle,
        romajiForDisplay,
        nativeForDisplay,
        matchScore,
        confidence,
      );
    } else {
      printHumanResults(
        searchTitle,
        candidateTitle,
        romajiForDisplay,
        nativeForDisplay,
        matchScore,
        confidence,
      );
    }
  } catch (error) {
    // Fallback to compiled version
    if (error instanceof Error) {
      console.error("Error loading TypeScript modules:", error.message);
    }
    loadScoringFunctionsFallback();
  }
}

function getConfidenceLevel(confidence: number): string {
  if (confidence >= 90) return "Near-perfect match";
  if (confidence >= 80) return "Strong match";
  if (confidence >= 65) return "Good match";
  if (confidence >= 50) return "Reasonable match";
  if (confidence >= 30) return "Weak match";
  if (confidence >= 15) return "Very weak match";
  return "Extremely weak match";
}

// Run the test
await runTest().catch((error) => {
  if (error instanceof Error) {
    console.error("Error:", error.message);
  } else {
    console.error("Unknown error occurred");
  }
  process.exit(1);
});
