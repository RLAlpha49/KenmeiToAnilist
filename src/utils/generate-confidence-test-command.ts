/**
 * @packageDocumentation
 * @module GenerateConfidenceTestCommand
 * @description Generates npm test:confidence commands from match data for bug reporting
 */

import type { MangaMatchResult } from "../api/anilist/types";

/**
 * Result object containing generated test command and associated metadata.
 * @source
 */
export interface ConfidenceTestCommand {
  command: string;
  description: string;
  searchTitle: string;
  candidateTitle: string;
  candidateRomaji: string | null;
  candidateNative: string | null;
  synonyms: string[];
}

const WINDOWS_PLATFORM_REGEX = /Win32|Win64|Windows/i;

const isRunningOnWindowsShell = (() => {
  if (typeof process !== "undefined" && process.platform) {
    return process.platform === "win32";
  }

  if (typeof navigator !== "undefined") {
    const userAgent = navigator.userAgent ?? "";
    return WINDOWS_PLATFORM_REGEX.test(userAgent);
  }

  return false;
})();

function quoteCommandArgument(value: string): string {
  if (value === "") {
    return '""';
  }

  if (isRunningOnWindowsShell) {
    const WINDOWS_SINGLE_QUOTES = ["’", "'"] as const;
    let escaped = value;
    for (const quote of WINDOWS_SINGLE_QUOTES) {
      escaped = escaped.replaceAll(quote, `${quote}${quote}`);
    }
    return `'${escaped}'`;
  }

  if (!value.includes("'")) {
    return `'${value}'`;
  }

  const escaped = value.split("'").join(`'"'"'`);
  return `'${escaped}'`;
}

/**
 * Generates npm test:confidence command from match result for local testing; includes metadata.
 * @param match - The manga match result containing Kenmei and AniList data.
 * @returns Object with generated command, description, and all metadata.
 * @source
 */
export function generateConfidenceTestCommand(
  match: MangaMatchResult,
): ConfidenceTestCommand {
  const searchTitle = match.kenmeiManga.title;

  // Get the first match's candidate (what the algorithm suggested)
  const firstMatch = match.anilistMatches?.[0];
  const candidate = firstMatch?.manga;

  if (!candidate) {
    throw new Error("No candidate match found");
  }

  // Build candidate title (prefer English, fall back to Romaji)
  const candidateTitle =
    candidate.title.english || candidate.title.romaji || "";
  const candidateRomaji = candidate.title.romaji || null;
  const candidateNative = candidate.title.native || null;

  // Collect synonyms from the candidate
  const synonyms = candidate.synonyms || [];

  // Build the command using npx tsx directly to avoid npm argument parsing issues
  // (npm filters out unrecognized flags like --synonyms)
  const commandParts: string[] = [
    `npx tsx scripts/test-confidence.mts`,
    quoteCommandArgument(searchTitle),
    quoteCommandArgument(candidateTitle),
  ];

  // Add romaji if different from English title
  if (candidateRomaji && candidateRomaji !== candidateTitle) {
    commandParts.push(quoteCommandArgument(candidateRomaji));
    // Add native title if present and different
    if (candidateNative && candidateNative !== candidateTitle) {
      commandParts.push(quoteCommandArgument(candidateNative));
    }
  } else if (candidateNative && candidateNative !== candidateTitle) {
    // If no romaji but we have native, add empty string placeholder then native
    commandParts.push(
      quoteCommandArgument(""),
      quoteCommandArgument(candidateNative),
    );
  }

  // Add synonyms if present
  if (synonyms.length > 0) {
    commandParts.push(
      `--synonyms=${quoteCommandArgument(JSON.stringify(synonyms))}`,
    );
  }

  const command = commandParts.join(" ");

  const description =
    `Test command to replicate this match's confidence calculation. ` +
    `Search term: "${searchTitle}" vs ` +
    `Candidate: "${candidateTitle}" (confidence: ${Math.round(firstMatch?.confidence || 0)}%)`;

  return {
    command,
    description,
    searchTitle,
    candidateTitle,
    candidateRomaji,
    candidateNative,
    synonyms,
  };
}

/**
 * Copies text to clipboard with Electron-compatible fallback for unfocused documents.
 * @param text - Text to copy to clipboard.
 * @returns Promise that resolves when copy succeeds.
 * @throws If copy operation fails in all attempts.
 * @source
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try the standard Clipboard API first
  if (navigator.clipboard && globalThis.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      // Document may not be focused in Electron - continue to fallback
      if (err instanceof Error && err.message.includes("not focused")) {
        // Expected in some Electron contexts, use fallback
      } else {
        throw err;
      }
    }
  }

  // Fallback: Use textarea selection method (works in Electron)
  fallbackCopyToClipboard(text);
}

/**
 * Fallback copy implementation using textarea selection; handles TypeScript deprecation warning.
 * @param text - Text to copy using execCommand method.
 * @throws If textarea selection or copy operation fails.
 * @internal
 * @source
 */
function fallbackCopyToClipboard(text: string): void {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);

  try {
    textArea.focus();
    textArea.select();

    const docWithExecCommand = document as {
      execCommand(commandId: string): boolean;
    };
    const successful = docWithExecCommand.execCommand("copy");
    if (!successful) {
      throw new Error("Failed to copy text using fallback method");
    }
  } finally {
    textArea.remove();
  }
}
