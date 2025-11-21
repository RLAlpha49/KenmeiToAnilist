#!/usr/bin/env node

import * as fs from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import cliProgress from "cli-progress";
import type { AniListManga } from "../src/api/anilist/types";
import type { AppError } from "../src/utils/error-handling";
import type { ExportFormat } from "../src/utils/export-utils";

/** Absolute path to the script as provided by process.argv. @source */
const scriptPath =
  process.argv && process.argv.length > 1 ? String(process.argv[1]) : "";
/** Resolved filename for this script; used for computing __dirname. @source */
const __filename = scriptPath ? path.resolve(scriptPath) : path.resolve(".");
/** Directory path containing this script. @source */
const __dirname = path.dirname(__filename);

/** Minimum length (post-normalization) for title fields. @source */
const TITLE_MIN_LENGTH = 2;
/** Maximum length (post-normalization) for title fields. @source */
const TITLE_MAX_LENGTH = 500;
/** Minimum length (post-normalization) for synonyms. @source */
const SYNONYM_MIN_LENGTH = 2;
/** Maximum length (post-normalization) for synonyms. @source */
const SYNONYM_MAX_LENGTH = 500;
/** Maximum number of synonyms allowed in input. @source */
const MAX_SYNONYMS = 12;
/** Directory where baseline files are stored. @source */
const BASELINE_DIR = path.resolve(__dirname, ".baselines");
/** Directory where comparison export files are written. @source */
const COMPARISON_EXPORT_DIR = path.resolve(BASELINE_DIR, "exports");
/** Default threshold (percent) for classifying meaningful confidence changes. @source */
const DEFAULT_CONFIDENCE_THRESHOLD = 5;
/** Default threshold for match score differences when detecting meaningful changes. @source */
const DEFAULT_MATCH_SCORE_THRESHOLD = 0.05;
/** Confidence value above which matches are considered near-perfect. @source */
const HIGH_CONFIDENCE_CUTOFF = 90;
/** Confidence value below which matches are considered low. @source */
const LOW_CONFIDENCE_CUTOFF = 50;

/**
 * Exit codes used by this CLI to provide clear signals for automation/CI.
 * - EXIT_SUCCESS (0): Normal completion
 * - EXIT_INVALID_USAGE (1): Bad CLI usage or validation error
 * - EXIT_RUNTIME_ERROR (2): Unexpected runtime error or scoring failure
 * - EXIT_FILESYSTEM_ERROR (3): Missing files (dist/), baseline, or other IO errors
 */
const EXIT_SUCCESS = 0;
const EXIT_INVALID_USAGE = 1;
const EXIT_RUNTIME_ERROR = 2;
const EXIT_FILESYSTEM_ERROR = 3;

/** Module type for the export utilities (builds export metadata / timestamps). @source */
type ExportUtilsModule = typeof import("../src/utils/export-utils");

/** Dynamic import of the export-utils module. @source */
const rawExportUtilsModule = (await import(
  "../src/utils/export-utils"
)) as ExportUtilsModule & {
  default?: ExportUtilsModule;
};
/** Resolved export utils (module default or module itself). @source */
const exportUtils = rawExportUtilsModule.default ?? rawExportUtilsModule;
/** Utility to build export metadata and generate timestamps for exports. @source */
const { buildExportMetadata, generateExportTimestamp } = exportUtils;

/** Module type for obtaining the current application version. @source */
type AppVersionModule = typeof import("../src/utils/app-version");
/** Dynamic import of the app-version module. @source */
const rawAppVersionModule = (await import(
  "../src/utils/app-version"
)) as AppVersionModule & {
  default?: AppVersionModule;
};
/** Resolved app version module, using default if present. @source */
const appVersionModule = rawAppVersionModule.default ?? rawAppVersionModule;
/** Function returning the current application version. @source */
const { getAppVersion } = appVersionModule;
type ErrorHandlingModule = typeof import("../src/utils/error-handling");
const rawErrorHandlingModule = (await import(
  "../src/utils/error-handling",
)) as ErrorHandlingModule & {
  default?: ErrorHandlingModule;
};
const errorHandling =
  rawErrorHandlingModule.default ?? rawErrorHandlingModule;

/** Parsed CLI arguments passed to this utility. @source */
interface TestConfidenceArgs {
  searchTitle: string;
  candidateTitle: string;
  candidateRomaji?: string;
  candidateNative?: string;
  synonyms: string[];
  json: boolean;
  compare?: boolean;
  saveBaseline?: boolean;
  baselineFile?: string;
  threshold?: number;
  exportFormat?: ExportFormat;
  verbose?: boolean;
}

/** Result of a single confidence calculation, including match score and level. @source */
interface TestConfidenceResult {
  searchTitle: string;
  candidateTitle: string;
  candidateRomaji: string;
  candidateNative: string;
  matchScore: number;
  confidence: number;
  confidenceLevel: string;
  matchDetails?: import("../src/api/matching/scoring/match-scorer").MatchScoreDetails;
}

/** Single entry stored within a baseline file for a given search title. @source */
interface BaselineEntry {
  searchTitle: string;
  candidateTitle: string;
  candidateRomaji?: string;
  candidateNative?: string;
  synonyms: string[];
  matchScore: number;
  confidence: number;
  confidenceLevel: string;
  timestamp: string;
  appVersion: string;
}

/** Metadata describing a baseline file (id & associated search title). @source */
interface BaselineFileMetadata {
  id: string;
  searchTitle: string;
}

/** Baseline file structure containing metadata and test entries. @source */
interface BaselineFile {
  metadata: BaselineFileMetadata;
  entries: BaselineEntry[];
}

/** Status returned when comparing current result to a baseline entry. @source */
type ComparisonStatus = "improved" | "regressed" | "unchanged";

/** Comparison summary for a single baseline entry vs current result. @source */
interface ComparisonResult {
  searchTitle: string;
  candidateTitle: string;
  baselineConfidence: number;
  currentConfidence: number;
  confidenceDelta: number;
  baselineMatchScore: number;
  currentMatchScore: number;
  matchScoreDelta: number;
  status: ComparisonStatus;
  changeIndicator: string;
  baselineConfidenceLevel: string;
  currentConfidenceLevel: string;
  baselineAppVersion: string;
  candidateRomaji?: string;
  candidateNative?: string;
}

/** Metadata describing an entire comparison report (timing, versions, thresholds). @source */
interface ComparisonMetadata {
  comparedAt: string;
  baselineId: string;
  baselineSearchTitle: string;
  baselineTimestamp: string;
  currentAppVersion: string;
  baselineAppVersion: string;
  baselineAppVersions: string[];
  totalTests: number;
  improved: number;
  regressed: number;
  unchanged: number;
  significantChanges: number;
  confidenceThreshold: number;
  /** Unit for confidenceThreshold (e.g., 'percent'). @source */
  confidenceThresholdUnit: string;
  matchScoreThreshold: number;
  /** Unit for matchScoreThreshold (e.g., '0-1 scale'). @source */
  matchScoreThresholdUnit: string;
  /** Default (code) value used for the confidence threshold, if not explicitly provided. @source */
  defaultConfidenceThreshold?: number;
  /** Unit for defaultConfidenceThreshold (e.g., 'percent'). @source */
  defaultConfidenceThresholdUnit?: string;
  /** Default (code) value used for the match score threshold, if not explicitly provided. @source */
  defaultMatchScoreThreshold?: number;
  /** Unit for defaultMatchScoreThreshold (e.g., '0-1 scale'). @source */
  defaultMatchScoreThresholdUnit?: string;
}

/** Complete comparison report package returned by runBatchComparison. @source */
interface ComparisonReport {
  metadata: ComparisonMetadata;
  results: ComparisonResult[];
}

/** Thresholds used to determine significant change in comparisons. @source */
interface ComparisonThresholds {
  confidence: number;
  matchScore: number;
}

/** Runtime scoring functions required by this script to compute matches and confidence. @source */
interface ScoringFunctions {
  calculateMatchScore: (manga: AniListManga, searchTitle: string) => number;
  calculateMatchScoreDetails: (
    manga: AniListManga,
    searchTitle: string,
  ) => import("../src/api/matching/scoring/match-scorer").MatchScoreDetails;
  calculateConfidence: (searchTitle: string, manga: AniListManga) => number;
}

/**
 * Log prefixes whose messages can be suppressed in non-verbose runs. These are intended for noisy
 * internal subsystems and should be kept in sync with shared logging prefixes so we don't block
 * important diagnostics from being visible in verbose mode.
 * @source
 */
const SILENCED_LOG_PREFIXES = [
  "[MangaSearchService]",
  "[Storage]",
  "[TitleNormalizer]",
] as const;

/** Console method names that are considered potentially noisy. @source */
type ConsoleNoiseMethodName = "debug" | "info";
/** Signature for console methods targeted by the internal log filter. @source */
type ConsoleNoiseMethod = (...args: unknown[]) => void;
/** Console methods that may be temporarily overridden to reduce noise. @source */
const FILTERED_CONSOLE_METHODS: ConsoleNoiseMethodName[] = ["info", "debug"];

/**
 * Determine whether a console log should be suppressed based on known internal prefixes.
 * @param args - Console arguments to inspect (first argument is expected to be a string).
 * @returns True if the message is an internal message that should be suppressed.
 * @source
 */
function shouldSuppressInternalLog(args: unknown[]): boolean {
  if (!args.length) return false;
  const firstArg = args[0];
  if (typeof firstArg !== "string") return false;
  const trimmed = firstArg.trimStart();
  if (!trimmed.startsWith("[")) return false;
  return SILENCED_LOG_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Temporarily override noisy console methods (debug/info) when suppression is enabled.
 * Returns a restore function that reverts the overrides.
 * @param shouldSuppress - Whether to suppress noisy console output.
 * @returns A function to call to restore original console behavior.
 * @source
 */
function applyInternalLogFilter(shouldSuppress: boolean): () => void {
  if (!shouldSuppress) {
    return () => {};
  }

  const originalMethods = new Map<ConsoleNoiseMethodName, ConsoleNoiseMethod>();

  for (const method of FILTERED_CONSOLE_METHODS) {
    // Bind to preserve the original console context and 'this' for the bound method.
    const originalMethod = console[method].bind(console) as ConsoleNoiseMethod;
    originalMethods.set(method, originalMethod);

    console[method] = ((...args: unknown[]) => {
      if (!shouldSuppressInternalLog(args)) {
        originalMethod(...args);
      }
    }) as ConsoleNoiseMethod;
  }

  return () => {
    for (const method of FILTERED_CONSOLE_METHODS) {
      const original = originalMethods.get(method);
      if (original) {
        console[method] = original;
      }
    }
  };
}

/**
 * Dynamically import scoring functions from source code under src/.
 * @returns An object implementing ScoringFunctions.
 * @throws {Error} If imports cannot be loaded.
 * @source
 */
async function loadScoringFunctions(): Promise<ScoringFunctions> {
  try {
    // Import from the actual source files
    const { calculateMatchScore, calculateMatchScoreDetails } = await import(
      "../src/api/matching/scoring/match-scorer"
    );
    const { calculateConfidence } = await import(
      "../src/api/matching/scoring/confidence-mapper"
    );

    return {
      calculateMatchScore,
      calculateMatchScoreDetails,
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

/**
 * Fallback behavior for loading scoring code from the compiled distribution (dist/).
 * Exits the process with code 1 on failure.
 * @source
 */
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
    process.exit(EXIT_FILESYSTEM_ERROR);
  } catch (error) {
    console.error("Failed to load scoring functions:", error);
    process.exit(EXIT_RUNTIME_ERROR);
  }
}

/**
 * Parse a synonyms flag value into an array of trimmed string synonyms.
 * Accepts JSON array notation or a comma-separated string.
 * @param value - Raw value passed on the CLI for synonyms.
 * @returns Array of trimmed synonym strings.
 * @source
 */
function parseSynonymsFlag(value: string): string[] {
  const normalized = value.trim();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalized);
      if (!Array.isArray(parsed)) {
        throwValidationError(
          "--synonyms JSON value must be an array of strings.",
          "synonyms_json_not_array",
        );
      }
      return parsed.map(String);
    } catch (error) {
      // Treat clearly JSON-like inputs (arrays) as errors if they do not parse or are not
      // an array. This avoids silently accepting malformed JSON when the caller intended
      // an array literal.
      throwValidationError(
        `Malformed JSON for --synonyms: ${(error as Error).message}`,
        "synonyms_json_malformed",
      );
    }
  }
  return normalized
    ? normalized
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/**
 * Handle boolean-style CLI flags, mutating params accordingly for recognized flags.
 * @param arg - The argument string to evaluate.
 * @param params - The parsed parameters object to mutate.
 * @returns True if the flag was recognized and handled.
 * @source
 */
function handleBooleanFlag(arg: string, params: TestConfidenceArgs): boolean {
  if (arg === "--json") {
    params.json = true;
    return true;
  }
  if (arg === "--compare") {
    params.compare = true;
    return true;
  }
  if (arg === "--save-baseline") {
    params.saveBaseline = true;
    return true;
  }
  if (arg === "--verbose") {
    params.verbose = true;
    return true;
  }
  return false;
}

/**
 * Parse CLI flags that include a value (e.g., --baseline-file=, --threshold=, --export=).
 * @param arg - The full CLI flag string.
 * @param params - The params object to populate.
 * @returns True if the flag was recognized and handled.
 * @source
 */
function handleValueFlag(arg: string, params: TestConfidenceArgs): boolean {
  if (arg.startsWith("--baseline-file=")) {
    params.baselineFile = arg.substring("--baseline-file=".length);
    return true;
  }
  if (arg.startsWith("--threshold=")) {
    const rawThreshold = arg.substring("--threshold=".length);
    const parsedThreshold = Number(rawThreshold);
    if (Number.isNaN(parsedThreshold)) {
      throwValidationError(
        "--threshold must be a numeric value.",
        "threshold_not_numeric",
      );
    }
    params.threshold = parsedThreshold;
    return true;
  }
  if (arg.startsWith("--export=")) {
    params.exportFormat = arg
      .substring("--export=".length)
      .toLowerCase() as ExportFormat;
    return true;
  }
  return false;
}

/**
 * Parse -s or --synonyms flags and merge supplied synonyms into params.synonyms.
 * @param arg - The raw CLI argument.
 * @param params - The params object to mutate.
 * @returns True if the synonyms option was found and applied.
 * @source
 */
function handleSynonymsOption(
  arg: string,
  params: TestConfidenceArgs,
): boolean {
  if (arg.startsWith("-s=") || arg.startsWith("--synonyms=")) {
    const prefix = arg.startsWith("-s=") ? "-s=" : "--synonyms=";
    params.synonyms.push(...parseSynonymsFlag(arg.substring(prefix.length)));
    return true;
  }
  return false;
}

/**
 * Parse CLI arguments into a TestConfidenceArgs structure.
 * Supports flags, positional values, -s/--synonyms, and truthy flags like --json.
 * @param args - Raw argv slice (excluding node and script name).
 * @returns The parsed TestConfidenceArgs object.
 * @source
 */
function parseArgs(args: string[]): TestConfidenceArgs {
  const params: TestConfidenceArgs = {
    searchTitle: "",
    candidateTitle: "",
    synonyms: [],
    json: false,
    verbose: false,
  };

  const positionalArgs: string[] = [];
  for (const arg of args) {
    if (handleBooleanFlag(arg, params)) continue;
    if (handleValueFlag(arg, params)) continue;
    if (handleSynonymsOption(arg, params)) continue;
    if (!arg.startsWith("-")) positionalArgs.push(arg);
  }

  params.searchTitle = positionalArgs[0]?.trim() ?? "";
  params.candidateTitle = positionalArgs[1]?.trim() ?? "";
  params.candidateRomaji = positionalArgs[2]?.trim() || undefined;
  params.candidateNative = positionalArgs[3]?.trim() || undefined;

  return params;
}

/**
 * Throw a structured application validation error.
 * @param message - Human-readable message describing the validation failure.
 * @param code - Optional machine-readable error code.
 * @throws {AppError}
 * @source
 */
function throwValidationError(message: string, code?: string): never {
  throw errorHandling.createError(
    errorHandling.ErrorType.VALIDATION,
    message,
    undefined,
    code,
  );
}

/**
 * Normalize a title string for validation (strip parentheses, convert smart quotes, normalize whitespace).
 * @param value - Raw title string.
 * @returns A normalized string suitable for length and content validation.
 * @source
 */
function normalizeForValidation(value: string): string {
  const withoutParentheses = value.replaceAll(/\s*\([^()]*\)\s*/g, " ");

  return withoutParentheses
    .replaceAll("-", " ")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("_", " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}

/**
 * Create a unique, deterministic baseline id from a search title using SHA1.
 * The returned id is the first 12 hex characters of the hash.
 * @param searchTitle - Title used to seed the id.
 * @returns A short, stable id string.
 * @source
 */
function createBaselineId(searchTitle: string): string {
  // Use SHA1 to generate a deterministic short id, then slice to make filenames manageable.
  return createHash("sha1").update(searchTitle).digest("hex").slice(0, 12);
}

/**
 * Validate that a title field meets project-specific constraints after normalizing it.
 * @param value - Title string to validate.
 * @param label - Label describing the title field (used in error messages).
 * @throws {AppError} If the title is empty or fails normalization constraints.
 * @source
 */
function validateTitleField(value: string, label: string): void {
  const normalized = normalizeForValidation(value);
  if (!value) {
    throwValidationError(
      `${label} cannot be empty or whitespace only.`,
      `${label.toLowerCase()}_missing`,
    );
  }
  if (!normalized) {
    throwValidationError(
      `${label} must contain letters or numbers after removing punctuation.`,
      `${label.toLowerCase()}_normalized_empty`,
    );
  }
  if (normalized.length < TITLE_MIN_LENGTH) {
    throwValidationError(
      `${label} must be at least ${TITLE_MIN_LENGTH} characters long after normalization (got ${normalized.length}).`,
    );
  }
  if (normalized.length > TITLE_MAX_LENGTH) {
    throwValidationError(
      `${label} cannot exceed ${TITLE_MAX_LENGTH} characters after normalization (got ${normalized.length}).`,
    );
  }
}

/**
 * Validate an optional title value, returning a trimmed string or undefined if empty.
 * @param value - Optional title.
 * @param label - Label for error messages when validation fails.
 * @returns Trimmed validated title or undefined.
 * @source
 */
function ensureOptionalTitle(
  value: string | undefined,
  label: string,
): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  validateTitleField(trimmed, label);
  return trimmed;
}

/**
 * Sanitize a list of synonyms: trim, dedupe (case-insensitive), and validate length constraints.
 * @param synonyms - Raw synonym values from CLI input.
 * @returns Sanitized array of synonyms.
 * @throws {AppError} If constraints are violated.
 * @source
 */
function sanitizeSynonyms(synonyms: string[]): string[] {
  if (!synonyms.length) return [];
  if (synonyms.length > MAX_SYNONYMS) {
    throwValidationError(
      `At most ${MAX_SYNONYMS} synonyms may be supplied (received ${synonyms.length}).`,
    );
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const [index, synonym] of synonyms.entries()) {
    const trimmed = synonym.trim();
    if (!trimmed) {
      throwValidationError(
        `Synonym #${index + 1} cannot be empty.`,
        "synonym_empty",
      );
    }

    const normalized = normalizeForValidation(trimmed);
    if (!normalized) {
      throwValidationError(
        `Synonym #${index + 1} must contain letters or numbers after normalization.`,
        "synonym_normalized_empty",
      );
    }

    if (normalized.length < SYNONYM_MIN_LENGTH) {
      throwValidationError(
        `Synonym #${index + 1} must be at least ${SYNONYM_MIN_LENGTH} characters long after normalization (got ${normalized.length}).`,
        "synonym_too_short",
      );
    }

    if (normalized.length > SYNONYM_MAX_LENGTH) {
      throwValidationError(
        `Synonym #${index + 1} cannot exceed ${SYNONYM_MAX_LENGTH} characters after normalization (got ${normalized.length}).`,
        "synonym_too_long",
      );
    }

    // Use normalized lowercase key for deduping synonyms irrespective of case/punctuation.
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sanitized.push(trimmed);
  }

  return sanitized;
}

/**
 * Validate and normalize the parsed CLI args for the test utility.
 * Ensures titles, optional romaji/native titles, and synonyms meet constraints.
 * @param args - Parsed CLI arguments to validate.
 * @returns The validated and possibly normalized TestConfidenceArgs.
 * @throws {AppError} When validation fails.
 * @source
 */
function validateTestConfidenceArgs(
  args: TestConfidenceArgs,
): TestConfidenceArgs {
  validateTitleField(args.searchTitle, "Search title");
  validateTitleField(args.candidateTitle, "Candidate title");

  const candidateRomaji = ensureOptionalTitle(
    args.candidateRomaji,
    "Candidate romaji title",
  );
  const candidateNative = ensureOptionalTitle(
    args.candidateNative,
    "Candidate native title",
  );
  const synonyms = sanitizeSynonyms(args.synonyms);

  return {
    ...args,
    candidateRomaji,
    candidateNative,
    synonyms,
  };
}

/**
 * Ensure a numeric value is finite and within an inclusive range.
 * @param value - The number to validate.
 * @param label - Label used in error messages.
 * @param min - Minimum allowable value.
 * @param max - Maximum allowable value.
 * @throws {AppError} When value is not finite or out of range.
 * @source
 */
function validateNumericRange(
  value: number,
  label: string,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value)) {
    throwValidationError(
      `${label} must be a finite number.`,
      "numeric_not_finite",
    );
  }
  if (value < min || value > max) {
    throwValidationError(
      `${label} must be between ${min} and ${max} (got ${value}).`,
      "numeric_out_of_range",
    );
  }
}

/**
 * Validate calculated result fields (matchScore & confidence) fall within expected bounds.
 * @param result - The computed TestConfidenceResult to validate.
 * @throws {AppError} When calculated values fall outside allowed ranges.
 * @source
 */
function validateTestConfidenceResult(result: TestConfidenceResult): void {
  validateNumericRange(result.matchScore, "Match score", 0, 1);
  validateNumericRange(result.confidence, "Confidence", 0, 100);
}

/**
 * Narrow unknown values into structured AppError instances.
 * @param value - Potentially an AppError instance.
 * @returns True when the value is an AppError.
 * @source
 */
function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AppError).message === "string" &&
    typeof (value as AppError).type === "string"
  );
}

/**
 * Create a mock AniListManga object used for running scoring tests against a single candidate.
 * @param englishTitle - Localized English title for the manga.
 * @param romajiTitle - Romaji variant of the title.
 * @param nativeTitle - Native language title.
 * @param synonyms - Synonyms to include on the mock object.
 * @returns A minimal AniListManga object suitable for scoring routines.
 * @source
 */
function createMockManga(
  englishTitle: string,
  romajiTitle: string,
  nativeTitle: string,
  synonyms: string[],
): AniListManga {
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
    tags: [],
    synonyms,
  };
}

/**
 * Print a user-friendly help message describing usage and options for this utility.
 * @source
 */
function printHelp(): void {
  console.log(`
Confidence Calculation Test Utility
====================================

Test the confidence percentage calculations for manga matching.

Usage:
  npx tsx scripts/test-confidence.mts <searchTitle> <candidateTitle> [candidateRomaji] [candidateNative] [options]

Examples:
  # Exact match (English title)
  npx tsx scripts/test-confidence.mts "Death Note" "Death Note"

  # With romaji (Japanese romanization)
  npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin"

  # With native and romaji (native takes priority)
  npx tsx scripts/test-confidence.mts "進撃の巨人" "The Unparalleled" "進撃の巨人" "進撃の巨人"

  # With synonyms for matching (use single quotes or -s= format for complex args)
  npx tsx scripts/test-confidence.mts "Title JP" "Title EN" "Title Romaji" "ネイティブ" -s="syn1,syn2"

  # With JSON output
  npx tsx scripts/test-confidence.mts "Death Note" "Death Note" --json

  # Save a baseline for regression testing
  npx tsx scripts/test-confidence.mts "Death Note" "Death Note" --save-baseline

  # Compare against the latest saved baseline
  npx tsx scripts/test-confidence.mts --compare

  # Compare against a specific baseline file with custom threshold and export
  npx tsx scripts/test-confidence.mts --compare --baseline-file="scripts/.baselines/confidence-baseline-2025-10-01T12-00-00-000Z.json" --threshold=3 --export=csv

Options:
  -s="title1,title2,..." or --synonyms="title1,title2,..."   Comma-separated synonyms
  --json                                                     Output results as JSON
  --save-baseline                                            Save the current result as a baseline in scripts/.baselines/
  --compare                                                  Run comparison mode using saved baselines
  --verbose                                                  Show internal info/debug logs from matching helpers (quiet by default). Note: Only 'info' and 'debug' levels from internal helper prefixes (SILENCED_LOG_PREFIXES) are suppressed unless verbose is enabled; 'error' logs remain visible.
  --baseline-file=<path>                                     Compare against a specific baseline JSON file (paths relative to repo root or absolute; e.g. scripts/.baselines/my-file.json)
  --threshold=<number>                                       Confidence threshold (in percentage points) used to classify changes; defaults to 5. The script additionally applies a minimum match-score delta (0-1 scale) of at least 0.05.
  --export=<json|csv|markdown>                               Export comparison reports to the requested format
  --help, -h                                                 Show this help message

Note: Baselines are written to scripts/.baselines/ (relative to the repo root) and are ignored by git via the rule 'scripts/.baselines/' in .gitignore. Use -s= instead of --synonyms= when running via 'npm run' to avoid npm interpreting it as config.
  `);
}

/**
 * Print the calculated result as compact JSON to stdout.
 * @param result - The result to print.
 * @source
 */
function printJsonResults(result: TestConfidenceResult): void {
  const payload = {
    ...result,
    matchScore: Number.parseFloat(result.matchScore.toFixed(4)),
  };
  console.log(JSON.stringify(payload, null, 2));
}

/**
 * Print the comparison report as compact JSON.
 * @param report - The report to print.
 * @source
 */
function printComparisonResultJson(report: ComparisonReport): void {
  console.log(JSON.stringify(report, null, 2));
}

/**
 * Format a human-friendly confidence bracket check line used in result output.
 * @param minConfidence - Lower inclusive bound of the bracket.
 * @param maxConfidence - Upper exclusive bound; pass null to indicate no upper bound.
 * @param actualConfidence - Actual percentage value to test.
 * @param description - Text describing the bracket.
 * @returns A formatted string representing the bracket and whether the actual value falls into it.
 * @source
 */
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
  const checkMark = isInBracket ? chalk.green("✓") : chalk.gray("✗");
  const text = isInBracket
    ? chalk.bold(`${rangeText}: ${description}`)
    : chalk.gray(`${rangeText}: ${description}`);
  return `  ${text} (actual: ${checkMark})`;
}

/**
 * Print a nicely formatted, colored human-readable result to the console.
 * @param result - The result object to render.
 * @source
 */
function printHumanResults(result: TestConfidenceResult): void {
  console.log(
    chalk.cyan(
      "\n╔════════════════════════════════════════════════════════════╗",
    ),
  );
  console.log(
    chalk.cyan(
      "║          CONFIDENCE CALCULATION TEST RESULTS               ║",
    ),
  );
  console.log(
    chalk.cyan(
      "╚════════════════════════════════════════════════════════════╝\n",
    ),
  );

  console.log(`Search Title:        ${chalk.bold(result.searchTitle)}`);
  console.log(`Candidate Title:     ${chalk.bold(result.candidateTitle)}`);
  if (
    result.candidateRomaji &&
    result.candidateRomaji !== result.candidateTitle
  ) {
    console.log(`Candidate Romaji:    ${result.candidateRomaji}`);
  }
  if (
    result.candidateNative &&
    result.candidateNative !== result.candidateTitle
  ) {
    console.log(`Candidate Native:    ${result.candidateNative}`);
  }

  console.log(
    chalk.gray(
      "\n────────────────────────────────────────────────────────────",
    ),
  );
  console.log(
    `Match Score:         ${chalk.yellow(result.matchScore.toFixed(4))} (0-1 scale)`,
  );

  let confidenceColor = chalk.red;
  if (result.confidence >= 90) confidenceColor = chalk.green;
  else if (result.confidence >= 65) confidenceColor = chalk.yellow;

  console.log(
    `Confidence:          ${confidenceColor(result.confidence + "%")} (0-100 scale)`,
  );
  console.log(
    `Confidence Level:    ${confidenceColor(result.confidenceLevel)}`,
  );

  if (result.matchDetails) {
    console.log(chalk.gray("\n  Match Components:"));
    console.log(`  • Type:            ${result.matchDetails.matchType}`);
    console.log(
      `  • Direct Match:    ${result.matchDetails.components.directMatch.toFixed(4)}`,
    );
    console.log(
      `  • Word Match:      ${result.matchDetails.components.wordMatch.toFixed(4)}`,
    );
    console.log(
      `  • Legacy Match:    ${result.matchDetails.components.legacyMatch.toFixed(4)}`,
    );
  }

  console.log(
    chalk.gray(
      "────────────────────────────────────────────────────────────\n",
    ),
  );
  // Show confidence brackets
  console.log("Confidence Brackets:");
  console.log(
    formatBracketCheck(90, null, result.confidence, "Near-perfect match"),
  );
  console.log(formatBracketCheck(80, 90, result.confidence, "Strong match"));
  console.log(formatBracketCheck(65, 80, result.confidence, "Good match"));
  console.log(
    formatBracketCheck(50, 65, result.confidence, "Reasonable match"),
  );
  console.log(formatBracketCheck(30, 50, result.confidence, "Weak match"));
  console.log(formatBracketCheck(15, 30, result.confidence, "Very weak match"));
  console.log(
    formatBracketCheck(1, 15, result.confidence, "Extremely weak match"),
  );
}

/**
 * Ensure a directory exists, creating it recursively if necessary.
 * @param dir - Directory path to create.
 * @returns Promise resolving when the directory exists.
 * @source
 */
async function ensureDirectoryExists(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * Build the canonical baseline filename for a given id.
 * @param id - Baseline id.
 * @returns Baseline filename.
 * @source
 */
function getBaselineFileNameForId(id: string): string {
  return `${id}.json`;
}

/**
 * Enumerate baseline files in the baseline directory and return their paths & metadata.
 * @returns Array of baseline file paths and metadata, sorted by modification time.
 * @source
 */
async function listBaselines(): Promise<
  Array<{ path: string; metadata: BaselineFileMetadata }>
> {
  try {
    await ensureDirectoryExists(BASELINE_DIR);
    const entries = await fs.promises.readdir(BASELINE_DIR, {
      withFileTypes: true,
    });
    const baselines: Array<{
      path: string;
      metadata: BaselineFileMetadata;
      modifiedAt: number;
    }> = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (path.extname(entry.name) !== ".json") continue;
      const filePath = path.join(BASELINE_DIR, entry.name);
      try {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const baseline = validateBaselineStructure(JSON.parse(raw));
        const stats = await fs.promises.stat(filePath);
        baselines.push({
          path: filePath,
          metadata: baseline.metadata,
          modifiedAt: stats.mtimeMs,
        });
      } catch {
        continue;
      }
    }
    baselines.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return baselines.map(({ path: p, metadata }) => ({ path: p, metadata }));
  } catch {
    return [];
  }
}

/**
 * Return the path to the most recent baseline file or null if none are present.
 * @returns The path to the newest baseline file or null.
 * @source
 */
async function getLatestBaselinePath(): Promise<string | null> {
  const baselines = await listBaselines();
  return baselines.length ? baselines[0].path : null;
}

/**
 * Resolve a baseline path to an absolute filesystem path, or return the most recent baseline path when none provided.
 * @param rawPath - Optional path provided via CLI.
 * @returns Resolved absolute baseline path.
 * @throws {AppError} When a baseline cannot be found.
 * @source
 */
async function resolveBaselinePath(rawPath?: string): Promise<string> {
  if (rawPath) {
    const resolved = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(process.cwd(), rawPath);
    if (!fs.existsSync(resolved)) {
      throwValidationError(`Baseline file not found: ${resolved}`);
    }
    return resolved;
  }

  const latest = await getLatestBaselinePath();
  if (!latest) {
    throwValidationError(
      "No baseline files found. Run with --save-baseline to capture a baseline result first.",
    );
  }
  return latest;
}

/**
 * Validate the shape and fields of a parsed baseline JSON object.
 * Normalizes appVersion fields and validates entries conform to BaselineEntry constraints.
 * @param data - Parsed JSON from a baseline file.
 * @returns A validated BaselineFile object.
 * @throws {AppError} When the structure is invalid.
 * @source
 */
function validateBaselineStructure(data: unknown): BaselineFile {
  if (!data || typeof data !== "object") {
    throwValidationError("Baseline file is malformed or empty.");
  }

  const baseline = data as BaselineFile;
  const { metadata, entries } = baseline;
  if (
    !metadata ||
    typeof metadata.id !== "string" ||
    !metadata.id ||
    typeof metadata.searchTitle !== "string" ||
    !metadata.searchTitle
  ) {
    throwValidationError("Baseline metadata is missing required information.");
  }

  if (!Array.isArray(entries) || !entries.length) {
    throwValidationError("Baseline file does not contain any entries.");
  }

  const normalizedEntries: BaselineEntry[] = entries.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throwValidationError("Baseline entry is malformed.");
    }

    const hasInvalidSynonyms =
      !Array.isArray(entry.synonyms) ||
      entry.synonyms.some((syn) => typeof syn !== "string");
    if (
      typeof entry.searchTitle !== "string" ||
      entry.searchTitle !== metadata.searchTitle ||
      typeof entry.candidateTitle !== "string" ||
      hasInvalidSynonyms ||
      typeof entry.matchScore !== "number" ||
      typeof entry.confidence !== "number" ||
      typeof entry.confidenceLevel !== "string" ||
      typeof entry.timestamp !== "string"
    ) {
      throwValidationError("Baseline entry is missing required fields.");
    }

    if (
      entry.candidateRomaji !== undefined &&
      typeof entry.candidateRomaji !== "string"
    ) {
      throwValidationError("Baseline entry has invalid romaji title.");
    }
    if (
      entry.candidateNative !== undefined &&
      typeof entry.candidateNative !== "string"
    ) {
      throwValidationError("Baseline entry has invalid native title.");
    }

    const normalizedAppVersion =
      typeof entry.appVersion === "string" && entry.appVersion.trim()
        ? entry.appVersion.trim()
        : undefined;
    const finalAppVersion = normalizedAppVersion ?? "unknown";

    return {
      ...entry,
      appVersion: finalAppVersion,
    };
  });

  const finalMetadata: BaselineFileMetadata = {
    ...metadata,
  };

  return {
    metadata: finalMetadata,
    entries: normalizedEntries,
  };
}

/**
 * Load and validate a baseline file, resolving the path and reading the JSON content.
 * @param baselineFilePath - Optional baseline file path; if omitted, the most recent baseline will be used.
 * @returns A validated BaselineFile object.
 * @throws {AppError} When a baseline cannot be loaded or validated.
 * @source
 */
async function loadBaseline(baselineFilePath?: string): Promise<BaselineFile> {
  const resolvedPath = await resolveBaselinePath(baselineFilePath);
  try {
    const raw = await fs.promises.readFile(resolvedPath, "utf-8");
    const parsed = JSON.parse(raw);
    return validateBaselineStructure(parsed);
  } catch (error) {
    throwValidationError(
      `Failed to read baseline at ${resolvedPath}: ${(error as Error).message}`,
    );
  }
}

/**
 * Read a baseline file from disk if it exists, returning null when missing.
 * @param filePath - Path to the file to read.
 * @returns The parsed and validated BaselineFile, or null if not present.
 * @throws {AppError} When a present file is malformed.
 * @source
 */
async function readBaselineFileIfExists(
  filePath: string,
): Promise<BaselineFile | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return validateBaselineStructure(JSON.parse(raw));
  } catch (error) {
    throwValidationError(
      `Failed to read baseline at ${filePath}: ${(error as Error).message}`,
    );
  }
}

/**
 * Save a TestConfidenceResult to a baseline file; appends or updates entries for the current appVersion.
 * Returns the path to the saved baseline file.
 * @param result - The computed result to save.
 * @param args - The CLI args used to produce the baseline (search title used for iding the baseline file).
 * @returns Absolute path to the saved baseline file.
 * @throws {AppError} When saving fails.
 * @source
 */
async function saveBaseline(
  result: TestConfidenceResult,
  args: TestConfidenceArgs,
): Promise<string> {
  await ensureDirectoryExists(BASELINE_DIR);
  const timestamp = new Date().toISOString();
  const baselineEntry: BaselineEntry = {
    searchTitle: result.searchTitle,
    candidateTitle: result.candidateTitle,
    candidateRomaji: result.candidateRomaji,
    candidateNative: result.candidateNative,
    synonyms: args.synonyms,
    matchScore: result.matchScore,
    confidence: result.confidence,
    confidenceLevel: result.confidenceLevel,
    timestamp,
    appVersion: getAppVersion(),
  };
  const baselineHash = createBaselineId(args.searchTitle);
  const filePath = path.join(
    BASELINE_DIR,
    getBaselineFileNameForId(baselineHash),
  );
  let existingPath: string | null = null;
  if (fs.existsSync(filePath)) {
    existingPath = filePath;
  }
  const existingFile =
    existingPath && fs.existsSync(existingPath)
      ? await readBaselineFileIfExists(existingPath)
      : null;

  let baselineFile: BaselineFile;
  if (existingFile) {
    if (existingFile.metadata.searchTitle !== args.searchTitle) {
      throwValidationError(
        `Baseline file ${existingPath} already exists for search title ${existingFile.metadata.searchTitle}.`,
      );
    }
    baselineFile = existingFile;
    baselineFile.metadata.id = baselineHash;
    const existingIndex = baselineFile.entries.findIndex(
      (entry) => entry.appVersion === baselineEntry.appVersion,
    );
    if (existingIndex >= 0) {
      baselineFile.entries[existingIndex] = baselineEntry;
    } else {
      baselineFile.entries.push(baselineEntry);
    }
  } else {
    baselineFile = {
      metadata: {
        id: baselineHash,
        searchTitle: args.searchTitle,
      },
      entries: [baselineEntry],
    };
  }

  await fs.promises.writeFile(
    filePath,
    JSON.stringify(baselineFile, null, 2),
    "utf-8",
  );

  if (
    existingFile &&
    existingPath &&
    existingPath !== filePath &&
    fs.existsSync(existingPath)
  ) {
    await fs.promises.unlink(existingPath).catch(() => undefined);
  }

  return filePath;
}

/**
 * Normalize a supplied threshold into a positive, finite number using the default if undefined.
 * @param value - Raw value provided via CLI.
 * @returns A normalized threshold value (positive number).
 * @throws {AppError} When invalid threshold value provided.
 * @source
 */
function normalizeThreshold(value?: number): number {
  const threshold = value ?? DEFAULT_CONFIDENCE_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throwValidationError("Threshold must be a positive number.");
  }
  return threshold;
}

/**
 * Calculate a numeric delta (current - baseline) and format to a fixed number of decimals.
 * @param baselineValue - Baseline numeric value.
 * @param currentValue - Current numeric value.
 * @param decimals - Number of decimals to round to (default: 2).
 * @returns The difference rounded to the requested decimals.
 * @source
 */
function calculateDelta(
  baselineValue: number,
  currentValue: number,
  decimals = 2,
): number {
  const delta = currentValue - baselineValue;
  return Number(delta.toFixed(decimals));
}

/**
 * Determine the change status (improved/regressed/unchanged) based on confidence and match score deltas.
 * @param baselineConfidence - Baseline confidence percentage.
 * @param currentConfidence - Current confidence percentage.
 * @param baselineMatchScore - Baseline match score.
 * @param currentMatchScore - Current match score.
 * @param thresholds - Thresholds determining significant changes.
 * @returns The comparison status.
 * @source
 */
function determineChangeStatus(
  baselineConfidence: number,
  currentConfidence: number,
  baselineMatchScore: number,
  currentMatchScore: number,
  thresholds: ComparisonThresholds,
): ComparisonStatus {
  const confidenceDelta = currentConfidence - baselineConfidence;
  const matchScoreDelta = currentMatchScore - baselineMatchScore;
  const hasConfidenceChange =
    Math.abs(confidenceDelta) >= thresholds.confidence;
  const hasMatchScoreChange =
    Math.abs(matchScoreDelta) >= thresholds.matchScore;

  const improvedConfidence = hasConfidenceChange && confidenceDelta > 0;
  const regressedConfidence = hasConfidenceChange && confidenceDelta < 0;
  const improvedMatch = hasMatchScoreChange && matchScoreDelta > 0;
  const regressedMatch = hasMatchScoreChange && matchScoreDelta < 0;

  if (improvedConfidence || improvedMatch) {
    return "improved";
  }
  if (regressedConfidence || regressedMatch) {
    return "regressed";
  }
  return "unchanged";
}

/**
 * Return a simple visual indicator for a change (arrow for direction or check/cross/equal for state).
 * @param status - The computed comparison status.
 * @param baselineConfidence - Baseline confidence percentage.
 * @param currentConfidence - Current confidence percentage.
 * @returns Single-character indicator string.
 * @source
 */
function getChangeIndicator(
  status: ComparisonStatus,
  baselineConfidence: number,
  currentConfidence: number,
): string {
  if (status === "improved") return "↑";
  if (status === "regressed") return "↓";
  if (
    baselineConfidence >= HIGH_CONFIDENCE_CUTOFF &&
    currentConfidence >= HIGH_CONFIDENCE_CUTOFF
  ) {
    return "✓";
  }
  if (
    baselineConfidence < LOW_CONFIDENCE_CUTOFF &&
    currentConfidence < LOW_CONFIDENCE_CUTOFF
  ) {
    return "✗";
  }
  return "=";
}

/**
 * Compare a baseline entry to a current result and compute deltas and status.
 * @param baselineEntry - The stored baseline entry.
 * @param currentResult - The freshly computed result.
 * @param thresholds - Thresholds for significance.
 * @returns A ComparisonResult summarizing deltas and status.
 * @source
 */
function compareResults(
  baselineEntry: BaselineEntry,
  currentResult: TestConfidenceResult,
  thresholds: ComparisonThresholds,
): ComparisonResult {
  const confidenceDelta = calculateDelta(
    baselineEntry.confidence,
    currentResult.confidence,
    2,
  );
  const matchScoreDelta = calculateDelta(
    baselineEntry.matchScore,
    currentResult.matchScore,
    4,
  );
  const status = determineChangeStatus(
    baselineEntry.confidence,
    currentResult.confidence,
    baselineEntry.matchScore,
    currentResult.matchScore,
    thresholds,
  );

  return {
    searchTitle: baselineEntry.searchTitle,
    candidateTitle: baselineEntry.candidateTitle,
    baselineConfidence: baselineEntry.confidence,
    currentConfidence: currentResult.confidence,
    confidenceDelta,
    baselineMatchScore: baselineEntry.matchScore,
    currentMatchScore: currentResult.matchScore,
    matchScoreDelta,
    status,
    changeIndicator: getChangeIndicator(
      status,
      baselineEntry.confidence,
      currentResult.confidence,
    ),
    baselineConfidenceLevel: baselineEntry.confidenceLevel,
    currentConfidenceLevel: currentResult.confidenceLevel,
    baselineAppVersion: baselineEntry.appVersion,
    candidateRomaji: baselineEntry.candidateRomaji,
    candidateNative: baselineEntry.candidateNative,
  };
}

/**
 * Run comparison on a single baseline entry by computing the current match score & confidence.
 * @param baselineEntry - Baseline entry to test.
 * @param scoringFunctions - Implementations of scoring functions to compute current values.
 * @param thresholds - Thresholds used for evaluating the change.
 * @returns The ComparisonResult for this entry.
 * @source
 */
async function runComparisonTest(
  baselineEntry: BaselineEntry,
  scoringFunctions: ScoringFunctions,
  thresholds: ComparisonThresholds,
): Promise<ComparisonResult> {
  const romajiForDisplay =
    baselineEntry.candidateRomaji || baselineEntry.candidateTitle;
  const nativeForDisplay =
    baselineEntry.candidateNative || baselineEntry.candidateTitle;
  const mockManga = createMockManga(
    baselineEntry.candidateTitle,
    romajiForDisplay,
    nativeForDisplay,
    baselineEntry.synonyms,
  );

  const currentMatchScore = scoringFunctions.calculateMatchScore(
    mockManga,
    baselineEntry.searchTitle,
  );
  const currentConfidence = scoringFunctions.calculateConfidence(
    baselineEntry.searchTitle,
    mockManga,
  );

  const currentResult: TestConfidenceResult = {
    searchTitle: baselineEntry.searchTitle,
    candidateTitle: baselineEntry.candidateTitle,
    candidateRomaji: romajiForDisplay,
    candidateNative: nativeForDisplay,
    matchScore: currentMatchScore,
    confidence: currentConfidence,
    confidenceLevel: getConfidenceLevel(currentConfidence),
  };

  return compareResults(baselineEntry, currentResult, thresholds);
}

/**
 * Run a batch comparison over all entries in a baseline file.
 * Displays a progress bar and returns the aggregated ComparisonReport.
 * @param scoringFunctions - Scoring implementations to use for calculations.
 * @param baselineFilePath - Optional explicit baseline file path.
 * @param thresholds - Threshold values for classification.
 * @returns A ComparisonReport containing metadata and all comparison results.
 * @source
 */
async function runBatchComparison(
  scoringFunctions: ScoringFunctions,
  baselineFilePath: string | undefined,
  thresholds: ComparisonThresholds,
): Promise<ComparisonReport> {
  const baselineFile = await loadBaseline(baselineFilePath);
  // Guard against valid-but-empty baseline files: provide a clear validation error
  // instead of relying on downstream behavior or confusing empty outputs.
  if (
    !Array.isArray(baselineFile.entries) ||
    baselineFile.entries.length === 0
  ) {
    throwValidationError(
      "Selected baseline contains no test cases. Please re-create or repair the baseline and try again.",
      "baseline_empty",
    );
  }
  const results: ComparisonResult[] = [];

  console.log(chalk.cyan("\nRunning comparisons..."));
  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(baselineFile.entries.length, 0);

  for (const entry of baselineFile.entries) {
    results.push(await runComparisonTest(entry, scoringFunctions, thresholds));
    progressBar.increment();
  }
  progressBar.stop();

  const improved = results.filter(
    (result) => result.status === "improved",
  ).length;
  const regressed = results.filter(
    (result) => result.status === "regressed",
  ).length;
  const unchanged = results.length - improved - regressed;

  const uniqueBaselineVersions = Array.from(
    new Set(baselineFile.entries.map((entry) => entry.appVersion)),
  );
  const baselineVersionLabel = uniqueBaselineVersions.length
    ? uniqueBaselineVersions.join(", ")
    : "unknown";

  const latestEntryTimestamp =
    baselineFile.entries.at(-1)?.timestamp ||
    baselineFile.entries[0]?.timestamp ||
    "unknown";

  const metadata: ComparisonMetadata = {
    comparedAt: new Date().toISOString(),
    baselineId: baselineFile.metadata.id,
    baselineSearchTitle: baselineFile.metadata.searchTitle,
    baselineTimestamp: latestEntryTimestamp,
    currentAppVersion: getAppVersion(),
    baselineAppVersion: baselineVersionLabel,
    baselineAppVersions: uniqueBaselineVersions,
    totalTests: results.length,
    improved,
    regressed,
    unchanged,
    significantChanges: improved + regressed,
    confidenceThreshold: thresholds.confidence,
    confidenceThresholdUnit: "percent",
    matchScoreThreshold: thresholds.matchScore,
    matchScoreThresholdUnit: "0-1 scale",
    defaultConfidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    defaultConfidenceThresholdUnit: "percent",
    defaultMatchScoreThreshold: DEFAULT_MATCH_SCORE_THRESHOLD,
    defaultMatchScoreThresholdUnit: "0-1 scale",
  };

  return { metadata, results };
}

/**
 * Format a signed number with a sign and fixed decimals, optionally with a suffix.
 * @param value - Numeric value to format.
 * @param decimals - Decimal places.
 * @param suffix - Optional suffix to append after the number (e.g., "%").
 * @returns Formatted, signed string representation.
 * @source
 */
function formatSignedNumber(
  value: number,
  decimals: number,
  suffix = "",
): string {
  // Normalize very small values to 0 to avoid negative zero and noisy signs in formatted output.
  const normalized = Math.abs(value) < Number.EPSILON ? 0 : value;
  let sign = "";
  if (normalized > 0) {
    sign = "+";
  } else if (normalized < 0) {
    sign = "-";
  }
  return `${sign}${Math.abs(normalized).toFixed(decimals)}${suffix}`;
}

/**
 * Print a single comparison result in human-readable format with context and colors.
 * @param result - The comparison result to render.
 * @param index - 1-based index for the display.
 * @param total - Total number of results for context.
 * @source
 */
function printComparisonResultHuman(
  result: ComparisonResult,
  index: number,
  total: number,
): void {
  let statusColor = chalk.gray;
  if (result.status === "improved") statusColor = chalk.green;
  else if (result.status === "regressed") statusColor = chalk.red;

  console.log(
    `\n[${index}/${total}] ${chalk.bold(result.searchTitle)} → ${chalk.bold(result.candidateTitle)} ${statusColor(result.changeIndicator)}`,
  );
  console.log(
    `  Baseline Confidence  : ${result.baselineConfidence.toFixed(2)}% (${result.baselineConfidenceLevel})`,
  );
  console.log(`  Baseline Version     : ${result.baselineAppVersion}`);
  console.log(
    `  Current Confidence   : ${result.currentConfidence.toFixed(2)}% (${result.currentConfidenceLevel})`,
  );
  console.log(
    `  Confidence Δ         : ${statusColor(formatSignedNumber(result.confidenceDelta, 2, "%"))}`,
  );
  console.log(
    `  Baseline Match Score : ${result.baselineMatchScore.toFixed(4)}`,
  );
  console.log(
    `  Current Match Score  : ${result.currentMatchScore.toFixed(4)}`,
  );
  console.log(
    `  Match Score Δ        : ${formatSignedNumber(result.matchScoreDelta, 4)}`,
  );
  console.log(`  Status               : ${statusColor(result.status)}`);
  if (
    result.candidateRomaji &&
    result.candidateRomaji !== result.candidateTitle
  ) {
    console.log(`  Candidate Romaji     : ${result.candidateRomaji}`);
  }
  if (
    result.candidateNative &&
    result.candidateNative !== result.candidateTitle
  ) {
    console.log(`  Candidate Native     : ${result.candidateNative}`);
  }
}

/**
 * Print a full comparison report (table + per-result details) to the console.
 * @param report - The comparison report to print.
 * @source
 */
function printComparisonReportHuman(report: ComparisonReport): void {
  const { metadata, results } = report;
  console.log(
    chalk.cyan(
      "\n╔════════════════════════════════════════════════════════════╗",
    ),
  );
  console.log(
    chalk.cyan(
      "║            CONFIDENCE COMPARISON REPORT                    ║",
    ),
  );
  console.log(
    chalk.cyan(
      "╚════════════════════════════════════════════════════════════╝\n",
    ),
  );
  console.log(
    `Baseline Search Title  : ${chalk.bold(metadata.baselineSearchTitle)}`,
  );
  console.log(`Baseline ID            : ${metadata.baselineId}`);
  console.log(`Baseline Versions      : ${metadata.baselineAppVersion}`);
  console.log(`Baseline Timestamp     : ${metadata.baselineTimestamp}`);
  console.log(`Current Version        : ${metadata.currentAppVersion}`);
  console.log(`Compared At            : ${metadata.comparedAt}`);
  console.log(
    `Threshold (confidence) : ${metadata.confidenceThreshold}% (${metadata.confidenceThresholdUnit})`,
  );
  console.log(
    `Threshold (match)      : ${metadata.matchScoreThreshold} (${metadata.matchScoreThresholdUnit})`,
  );
  console.log(
    `Summary                : ${metadata.totalTests} total (${chalk.green(metadata.improved + " improved")}, ${chalk.red(metadata.regressed + " regressed")}, ${chalk.gray(metadata.unchanged + " unchanged")})`,
  );
  console.log("\nComparison Table:");

  const table = new Table({
    head: [
      chalk.bold("Test Case"),
      chalk.bold("Base"),
      chalk.bold("Current"),
      chalk.bold("Confidence Δ"),
      chalk.bold("Status"),
      chalk.bold("Ind"),
    ],
    colWidths: [40, 10, 10, 14, 12, 6],
    wordWrap: true,
    style: {
      head: [],
      border: [],
    },
  });

  for (const result of results) {
    let statusColor = chalk.gray;
    if (result.status === "improved") statusColor = chalk.green;
    else if (result.status === "regressed") statusColor = chalk.red;

    table.push([
      `${result.searchTitle} → ${result.candidateTitle}`,
      `${result.baselineConfidence.toFixed(2)}%`,
      `${result.currentConfidence.toFixed(2)}%`,
      formatSignedNumber(result.confidenceDelta, 2, "%"),
      statusColor(result.status),
      statusColor(result.changeIndicator),
    ]);
  }

  console.log(table.toString());

  for (const [index, result] of results.entries()) {
    printComparisonResultHuman(result, index + 1, results.length);
  }
}

/**
 * Print the comparison report as compact JSON.
 * @param value - The string or number to escape.
 * @returns CSV-safe cell string.
 * @source
 */
function escapeCsvCell(value: string | number): string {
  const cell = String(value);
  return `"${cell.replaceAll('"', '""')}"`;
}

/**
 * Escape Markdown table cell value by escaping pipe characters.
 * @param value - The raw string value.
 * @returns Escaped Markdown cell string.
 * @source
 */
function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", String.raw`\|`);
}

/**
 * Export a comparison report to JSON and return the path to the written file.
 * @param report - The comparison report to export.
 * @returns File path to the written JSON export.
 * @source
 */
async function exportComparisonToJson(
  report: ComparisonReport,
): Promise<string> {
  await ensureDirectoryExists(COMPARISON_EXPORT_DIR);
  const metadata = buildExportMetadata("json", report.results.length);
  const payload = {
    exportMetadata: metadata,
    comparison: report,
  };
  const fileName = `comparison-report-${generateExportTimestamp()}.json`;
  const filePath = path.join(COMPARISON_EXPORT_DIR, fileName);
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
  return filePath;
}

/**
 * Export a comparison report to CSV format and return the file path.
 * @param report - The comparison report to export.
 * @returns File path to the written CSV export.
 * @source
 */
async function exportComparisonToCsv(
  report: ComparisonReport,
): Promise<string> {
  await ensureDirectoryExists(COMPARISON_EXPORT_DIR);
  const exportMetadata = buildExportMetadata("csv", report.results.length);
  const metadataLines = [
    `# Compared At,${report.metadata.comparedAt}`,
    `# Baseline Timestamp,${report.metadata.baselineTimestamp}`,
    `# Baseline Search Title,${report.metadata.baselineSearchTitle}`,
    `# Baseline ID,${report.metadata.baselineId}`,
    `# Baseline Versions,${report.metadata.baselineAppVersion}`,
    `# Current Version,${report.metadata.currentAppVersion}`,
    `# Confidence Threshold,${report.metadata.confidenceThreshold} (${report.metadata.confidenceThresholdUnit})`,
    `# Match Score Threshold,${report.metadata.matchScoreThreshold} (${report.metadata.matchScoreThresholdUnit})`,
    `# Default Confidence Threshold,${report.metadata.defaultConfidenceThreshold} (${report.metadata.defaultConfidenceThresholdUnit})`,
    `# Default Match Score Threshold,${report.metadata.defaultMatchScoreThreshold} (${report.metadata.defaultMatchScoreThresholdUnit})`,
    `# Exported At,${exportMetadata.exportedAt}`,
    `# Export Format,${exportMetadata.format}`,
    `# Export App Version,${exportMetadata.appVersion}`,
    "",
  ];
  const header = [
    "Test Case",
    "Baseline Confidence",
    "Current Confidence",
    "Confidence Δ",
    "Baseline Match Score",
    "Current Match Score",
    "Match Score Δ",
    "Status",
    "Indicator",
  ]
    .map(escapeCsvCell)
    .join(",");

  const rows = report.results.map((result) =>
    [
      escapeCsvCell(`${result.searchTitle} → ${result.candidateTitle}`),
      escapeCsvCell(`${result.baselineConfidence.toFixed(2)}%`),
      escapeCsvCell(`${result.currentConfidence.toFixed(2)}%`),
      escapeCsvCell(formatSignedNumber(result.confidenceDelta, 2, "%")),
      escapeCsvCell(result.baselineMatchScore.toFixed(4)),
      escapeCsvCell(result.currentMatchScore.toFixed(4)),
      escapeCsvCell(formatSignedNumber(result.matchScoreDelta, 4)),
      escapeCsvCell(result.status),
      escapeCsvCell(result.changeIndicator),
    ].join(","),
  );

  const content = [...metadataLines, header, ...rows].join("\n");
  const fileName = `comparison-report-${generateExportTimestamp()}.csv`;
  const filePath = path.join(COMPARISON_EXPORT_DIR, fileName);
  await fs.promises.writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * Export a comparison report to Markdown and return the file path.
 * @param report - The comparison report to export.
 * @returns File path to the written Markdown export.
 * @source
 */
async function exportComparisonToMarkdown(
  report: ComparisonReport,
): Promise<string> {
  await ensureDirectoryExists(COMPARISON_EXPORT_DIR);
  const exportMetadata = buildExportMetadata("markdown", report.results.length);
  const lines = [
    "# Comparison Report",
    "",
    `- Compared At: ${report.metadata.comparedAt}`,
    `- Baseline Search Title: ${report.metadata.baselineSearchTitle}`,
    `- Baseline ID: ${report.metadata.baselineId}`,
    `- Baseline Versions: ${report.metadata.baselineAppVersion}`,
    `- Baseline Timestamp: ${report.metadata.baselineTimestamp}`,
    `- Current Version: ${report.metadata.currentAppVersion}`,
    `- Confidence Threshold: ${report.metadata.confidenceThreshold} (${report.metadata.confidenceThresholdUnit})`,
    `- Match Score Threshold: ${report.metadata.matchScoreThreshold} (${report.metadata.matchScoreThresholdUnit})`,
    `- Default Confidence Threshold: ${report.metadata.defaultConfidenceThreshold} (${report.metadata.defaultConfidenceThresholdUnit})`,
    `- Default Match Score Threshold: ${report.metadata.defaultMatchScoreThreshold} (${report.metadata.defaultMatchScoreThresholdUnit})`,
    `- Exported At: ${exportMetadata.exportedAt}`,
    `- Export Format: ${exportMetadata.format}`,
    `- Export App Version: ${exportMetadata.appVersion}`,
    "",
    "| Test Case | Baseline Confidence | Current Confidence | Confidence Δ | Status | Indicator |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.results.map((result) => {
      const testCaseLabel = `${result.searchTitle} → ${result.candidateTitle}`;
      const baselineConfidence = `${result.baselineConfidence.toFixed(2)}%`;
      const currentConfidence = `${result.currentConfidence.toFixed(2)}%`;
      const confidenceDelta = formatSignedNumber(
        result.confidenceDelta,
        2,
        "%",
      );
      return `| ${escapeMarkdownCell(testCaseLabel)} | ${escapeMarkdownCell(baselineConfidence)} | ${escapeMarkdownCell(
        currentConfidence,
      )} | ${escapeMarkdownCell(confidenceDelta)} | ${escapeMarkdownCell(result.status)} | ${escapeMarkdownCell(result.changeIndicator)} |`;
    }),
  ];
  const fileName = `comparison-report-${generateExportTimestamp()}.md`;
  const filePath = path.join(COMPARISON_EXPORT_DIR, fileName);
  await fs.promises.writeFile(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

/**
 * Export a comparison report to the requested format (json/csv/markdown).
 * @param report - Report to export.
 * @param format - Export format enum.
 * @returns Path to the exported file in the exports directory.
 * @source
 */
async function exportComparisonReport(
  report: ComparisonReport,
  format: ExportFormat,
): Promise<string> {
  switch (format) {
    case "json":
      return exportComparisonToJson(report);
    case "csv":
      return exportComparisonToCsv(report);
    case "markdown":
      return exportComparisonToMarkdown(report);
    default:
      throwValidationError(`Unsupported export format: ${format}`);
  }
}

/**
 * Execute the comparison flow: run batch comparisons, print, and optionally export the results.
 * @param functions - Scoring functions used to compute current values.
 * @param parsedArgs - Parsed CLI arguments for comparison flow.
 * @returns Promise that resolves when the flow completes.
 * @source
 */
async function executeComparisonFlow(
  functions: ScoringFunctions,
  parsedArgs: TestConfidenceArgs,
): Promise<void> {
  const confidenceThreshold = normalizeThreshold(parsedArgs.threshold);
  const matchScoreThreshold = Math.max(
    DEFAULT_MATCH_SCORE_THRESHOLD,
    confidenceThreshold / 100,
  );
  const report = await runBatchComparison(functions, parsedArgs.baselineFile, {
    confidence: confidenceThreshold,
    matchScore: matchScoreThreshold,
  });

  if (parsedArgs.json) {
    printComparisonResultJson(report);
  } else {
    printComparisonReportHuman(report);
  }

  if (parsedArgs.exportFormat) {
    const exportPath = await exportComparisonReport(
      report,
      parsedArgs.exportFormat,
    );
    console.log(`Comparison exported to ${exportPath}`);
  }
}

/**
 * Execute a single test using the parsed args, compute match and confidence, and optionally save as baseline.
 * @param functions - Scoring functions to compute match and confidence.
 * @param parsedArgs - Parsed and validated CLI arguments for the test.
 * @returns Promise that resolves after printing/saving results.
 * @source
 */
async function executeSingleTest(
  functions: ScoringFunctions,
  parsedArgs: TestConfidenceArgs,
): Promise<void> {
  if (!parsedArgs.searchTitle || !parsedArgs.candidateTitle) {
    throwValidationError(
      "Search and candidate titles are required when not running comparison mode.",
    );
  }

  const validatedArgs = validateTestConfidenceArgs(parsedArgs);
  const romajiForDisplay =
    validatedArgs.candidateRomaji || validatedArgs.candidateTitle;
  const nativeForDisplay =
    validatedArgs.candidateNative || validatedArgs.candidateTitle;
  const mockManga = createMockManga(
    validatedArgs.candidateTitle,
    romajiForDisplay,
    nativeForDisplay,
    validatedArgs.synonyms,
  );

  const matchDetails = functions.calculateMatchScoreDetails(
    mockManga,
    validatedArgs.searchTitle,
  );
  const matchScore = matchDetails.score;
  const confidence = functions.calculateConfidence(
    validatedArgs.searchTitle,
    mockManga,
  );

  const result: TestConfidenceResult = {
    searchTitle: validatedArgs.searchTitle,
    candidateTitle: validatedArgs.candidateTitle,
    candidateRomaji: romajiForDisplay,
    candidateNative: nativeForDisplay,
    matchScore,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    matchDetails,
  };

  validateTestConfidenceResult(result);

  if (validatedArgs.json) {
    printJsonResults(result);
  } else {
    printHumanResults(result);
  }

  if (validatedArgs.saveBaseline) {
    const savedPath = await saveBaseline(result, validatedArgs);
    console.log(`\nBaseline saved to ${savedPath}`);
  }
}

/**
 * Main entry: parse command-line arguments and dispatch to single test or comparison flow.
 * Exits the process on completion or on validation errors.
 * @returns Promise that resolves when the process completes.
 * @source
 */
async function runTest(): Promise<void> {
  const args = process.argv.slice(2);

  if (!args.length || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(EXIT_SUCCESS);
  }

  try {
    const parsedArgs = parseArgs(args);
    const restoreInternalLogs = applyInternalLogFilter(
      parsedArgs.verbose !== true,
    );
    let requestedExitCode: number | undefined;

    try {
      if (parsedArgs.compare && parsedArgs.saveBaseline) {
        throwValidationError(
          "Cannot use --compare and --save-baseline together.",
        );
      }

      if (parsedArgs.exportFormat && !parsedArgs.compare) {
        throwValidationError(
          "--export flag is only available in comparison mode.",
        );
      }

      const functions = await loadScoringFunctions();

      if (parsedArgs.compare) {
        await executeComparisonFlow(functions, parsedArgs);
        return;
      }

      await executeSingleTest(functions, parsedArgs);
    } finally {
      restoreInternalLogs();
      if (requestedExitCode !== undefined) {
        process.exit(requestedExitCode);
      }
    }
  } catch (error) {
    if (isAppError(error)) {
      console.error("Validation error:", error.message);
      process.exit(EXIT_INVALID_USAGE);
      return;
    }

    // Fallback to compiled version
    if (error instanceof Error) {
      console.error("Error loading TypeScript modules:", error.message);
    }
    loadScoringFunctionsFallback();
  }
}

/**
 * Convert a numeric confidence percentage into a short human-readable label.
 * @param confidence - Confidence percentage (0-100).
 * @returns A short label describing the strength of the match.
 * @source
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 90) return "Near-perfect match";
  if (confidence >= 80) return "Strong match";
  if (confidence >= 65) return "Good match";
  if (confidence >= 50) return "Reasonable match";
  if (confidence >= 30) return "Weak match";
  if (confidence >= 15) return "Very weak match";
  return "Extremely weak match";
}

try {
  await runTest();
} catch (error) {
  if (error instanceof Error) {
    console.error("Error:", error.message);
  } else {
    console.error("Unknown error occurred");
  }
  process.exit(EXIT_RUNTIME_ERROR);
}
