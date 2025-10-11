/**
 * @packageDocumentation
 * @module kenmei-parser
 * @description Parser for Kenmei export files, including JSON and CSV parsing, batch processing, and metadata extraction utilities.
 */

import {
  DEFAULT_PARSE_OPTIONS,
  KenmeiExport,
  KenmeiManga,
  KenmeiParseOptions,
  KenmeiStatus,
  ProcessingResult,
  ValidationError,
} from "./types";

/**
 * Parse a Kenmei export file.
 *
 * @param fileContent - The content of the Kenmei export file as text.
 * @param options - Parsing options.
 * @returns Parsed Kenmei data.
 * @throws Error if the file cannot be parsed.
 * @source
 */
export function parseKenmeiExport(
  fileContent: string,
  options: Partial<KenmeiParseOptions> = {},
): KenmeiExport {
  const parseOptions = { ...DEFAULT_PARSE_OPTIONS, ...options };
  try {
    const data = JSON.parse(fileContent);

    if (!parseOptions.validateStructure) return data as KenmeiExport;

    // Quick shape check
    if (!data?.manga || !Array.isArray(data.manga)) {
      throw new Error("Invalid Kenmei export: missing or invalid manga array");
    }

    // Validate and normalize each manga entry
    for (const [index, manga] of data.manga.entries()) {
      if (!manga?.title) {
        throw new Error(`Manga at index ${index} is missing a title`);
      }

      if (!manga.status || !isValidStatus(manga.status)) {
        manga.status = parseOptions.defaultStatus;
      }

      if (typeof manga.chapters_read !== "number") manga.chapters_read = 0;
    }

    return data as KenmeiExport;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("Invalid JSON format in export file");
    throw error;
  }
}

/**
 * Create a default manga entry with fallback values
 */
function createDefaultMangaEntry(
  manga: KenmeiManga,
  index: number,
  defaultStatus: KenmeiStatus,
): KenmeiManga {
  return {
    ...manga,
    status: manga.status ?? defaultStatus,
    chapters_read:
      typeof manga.chapters_read === "number" ? manga.chapters_read : 0,
    score: typeof manga.score === "number" ? manga.score : 0,
    id: manga.id ?? index,
    url: manga.url ?? "",
    created_at: manga.created_at ?? new Date().toISOString(),
    updated_at: manga.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Process a single manga entry with validation
 */
function processSingleManga(
  manga: KenmeiManga,
  index: number,
  parseOptions: KenmeiParseOptions,
  validationErrors: ValidationError[],
  processedEntries: KenmeiManga[],
): void {
  try {
    const validatedManga = validateAndNormalizeManga(
      manga,
      index,
      parseOptions,
    );
    processedEntries.push(validatedManga);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    validationErrors.push({
      mangaTitle: manga.title ?? `Unknown manga at index ${index}`,
      field: "general",
      message,
      index,
    });

    if (!parseOptions.allowPartialData || !manga.title) return;

    const defaultManga = createDefaultMangaEntry(
      manga,
      index,
      parseOptions.defaultStatus,
    );
    processedEntries.push(defaultManga);
  }
}

/**
 * Process Kenmei manga list in batches.
 *
 * @param mangaList - List of manga to process.
 * @param batchSize - Size of each batch.
 * @param options - Processing options.
 * @returns Processing results.
 * @source
 */
export function processKenmeiMangaBatches(
  mangaList: KenmeiManga[],
  batchSize = 50,
  options: Partial<KenmeiParseOptions> = {},
): ProcessingResult {
  const parseOptions = { ...DEFAULT_PARSE_OPTIONS, ...options };
  const validationErrors: ValidationError[] = [];
  const processedEntries: KenmeiManga[] = [];

  if (mangaList.length === 0) {
    return {
      processedEntries,
      validationErrors,
      totalEntries: 0,
      successfulEntries: 0,
    };
  }

  for (let i = 0; i < mangaList.length; i += batchSize) {
    const batch = mangaList.slice(i, i + batchSize);
    for (const [j, manga] of batch.entries()) {
      const index = i + j;
      processSingleManga(
        manga,
        index,
        parseOptions,
        validationErrors,
        processedEntries,
      );
    }
  }

  return {
    processedEntries,
    validationErrors,
    totalEntries: mangaList.length,
    successfulEntries: processedEntries.length,
  };
}

/**
 * Validate and normalize a manga entry
 * @param manga The manga entry to validate
 * @param index Index in the original array
 * @param options Parsing options
 * @returns Validated manga entry
 * @throws Error if validation fails
 */
function validateAndNormalizeManga(
  manga: KenmeiManga,
  index: number,
  options: KenmeiParseOptions,
): KenmeiManga {
  const errors: string[] = [];

  if (!manga?.title) errors.push("Missing title");

  if (!manga.status || !isValidStatus(manga.status))
    manga.status = options.defaultStatus;

  manga.chapters_read =
    typeof manga.chapters_read === "number" ? manga.chapters_read : 0;
  manga.volumes_read =
    typeof manga.volumes_read === "number" ? manga.volumes_read : 0;
  manga.score = typeof manga.score === "number" ? manga.score : 0;

  manga.created_at = manga.created_at ?? new Date().toISOString();
  manga.updated_at = manga.updated_at ?? new Date().toISOString();

  if (errors.length > 0 && !options.allowPartialData) {
    throw new Error(
      `Validation failed for manga at index ${index}: ${errors.join(", ")}`,
    );
  }

  return manga;
}

/**
 * Check if a status value is valid
 * @param status The status to check
 * @returns Whether the status is valid
 */
function isValidStatus(status: string): boolean {
  const valid = new Set([
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_read",
  ]);
  return valid.has(status);
}

/**
 * Validate CSV data structure and headers
 */
function validateCsvStructure(rows: string[][]): string[] {
  if (!rows || rows.length < 2)
    throw new Error("CSV file does not contain enough data");

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const requiredHeaders = ["title"];
  for (const required of requiredHeaders) {
    if (!headers.includes(required))
      throw new Error(`CSV is missing required header: ${required}`);
  }

  return headers;
}

/**
 * Check if a row should be skipped due to invalid data
 */
function shouldSkipRow(
  values: string[],
  headers: string[],
  rowIndex: number,
): boolean {
  if (!values || values.length < 2) {
    console.warn(
      `Skipping row ${rowIndex + 1} with insufficient fields: ${values?.join(",")}`,
    );
    return true;
  }

  const titleIndex = headers.indexOf("title");
  const potentialTitle = titleIndex >= 0 ? values[titleIndex] : undefined;
  if (!potentialTitle) return false;

  if (
    /^(Chapter|Ch\.|Vol\.|Volume) \d+$/i.test(potentialTitle) ||
    /^\d+$/.test(potentialTitle)
  ) {
    console.warn(
      `Skipping row ${rowIndex + 1} with invalid title: "${potentialTitle}"`,
    );
    return true;
  }

  return false;
}

/**
 * Create entry mapping from headers and values
 */
function createEntryMapping(
  headers: string[],
  values: string[],
): Record<string, string> {
  const entry: Record<string, string> = {};
  for (let idx = 0; idx < headers.length; idx++) {
    const header = headers[idx];
    if (idx < values.length && values[idx] !== undefined) {
      entry[header] = values[idx];
    }
  }
  return entry;
}

/**
 * Parse numeric values safely
 */
function parseIntSafe(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleanValue = value.replaceAll(/[^\d.-]/g, "").trim();
  if (!cleanValue) return undefined;
  const parsed = Number.parseInt(cleanValue, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Find a value using flexible column mappings
 */
function findValue(
  entry: Record<string, string>,
  mappings: string[],
): string | undefined {
  const key = mappings.find((m) => entry[m] !== undefined);
  return key ? entry[key] : undefined;
}

/**
 * Extract all field values from a CSV entry
 */
function extractFieldValues(entry: Record<string, string>) {
  const columnMappings = {
    chapter: [
      "last_chapter_read",
      "chapters_read",
      "chapter",
      "current_chapter",
    ],
    volume: ["last_volume_read", "volumes_read", "volume", "current_volume"],
    status: ["status", "reading_status"],
    score: ["score", "rating"],
    url: ["series_url", "url", "link"],
    notes: ["notes", "comments"],
    date: ["last_read_at", "updated_at", "date"],
  };

  return {
    chapterValue: findValue(entry, columnMappings.chapter),
    volumeValue: findValue(entry, columnMappings.volume),
    statusValue: findValue(entry, columnMappings.status),
    scoreValue: findValue(entry, columnMappings.score),
    urlValue: findValue(entry, columnMappings.url),
    notesValue: findValue(entry, columnMappings.notes),
    dateValue: findValue(entry, columnMappings.date),
    lastReadAt: findValue(entry, [
      "last_read_at",
      "last read at",
      "lastreadat",
      "last_read",
      "date_last_read",
    ]),
  };
}

/**
 * Create a manga entry from parsed CSV values
 */
function createMangaEntry(
  entry: Record<string, string>,
  fieldValues: {
    chapterValue: string | undefined;
    volumeValue: string | undefined;
    statusValue: string | undefined;
    scoreValue: string | undefined;
    urlValue: string | undefined;
    notesValue: string | undefined;
    dateValue: string | undefined;
    lastReadAt: string | undefined;
  },
): KenmeiManga {
  // Parse chapter and volume numbers
  const chaptersRead = parseIntSafe(fieldValues.chapterValue) ?? 0;
  const volumesRead = parseIntSafe(fieldValues.volumeValue);

  return {
    id: Number.parseInt(entry.id ?? "0"),
    title: entry.title,
    status: validateStatus(fieldValues.statusValue),
    score: fieldValues.scoreValue
      ? Number.parseFloat(fieldValues.scoreValue)
      : 0,
    url: fieldValues.urlValue ?? "",
    cover_url: entry.cover_url,
    chapters_read: chaptersRead,
    total_chapters: entry.total_chapters
      ? Number.parseInt(entry.total_chapters)
      : undefined,
    volumes_read: volumesRead,
    total_volumes: entry.total_volumes
      ? Number.parseInt(entry.total_volumes)
      : undefined,
    notes: fieldValues.notesValue ?? "",
    last_read_at: fieldValues.lastReadAt,
    created_at:
      entry.created_at ?? fieldValues.dateValue ?? new Date().toISOString(),
    updated_at:
      entry.updated_at ?? fieldValues.dateValue ?? new Date().toISOString(),
    author: entry.author,
    alternative_titles: entry.alternative_titles
      ? entry.alternative_titles.split(";")
      : undefined,
  };
}

/**
 * Process validation results and update manga array
 */
function processValidationResults(
  manga: KenmeiManga[],
  parseOptions: KenmeiParseOptions,
): void {
  if (!parseOptions.validateStructure) return;

  const result = processKenmeiMangaBatches(manga, 100, parseOptions);
  if (result.validationErrors.length > 0 && !parseOptions.allowPartialData) {
    throw new Error(
      `${result.validationErrors.length} validation errors found in CSV import`,
    );
  }

  if (result.processedEntries.length === 0) return;
  manga.length = 0;
  manga.push(...result.processedEntries);
}

/**
 * Parse a Kenmei CSV export file.
 *
 * @param csvString - The content of the CSV file.
 * @param options - Parsing options.
 * @returns Parsed Kenmei data.
 * @source
 */
export const parseKenmeiCsvExport = (
  csvString: string,
  options: Partial<KenmeiParseOptions> = {},
): KenmeiExport => {
  const parseOptions = { ...DEFAULT_PARSE_OPTIONS, ...options };

  try {
    // Normalize line breaks to Unix style using replaceAll
    const normalizedCsv = csvString
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n");

    // Parse CSV rows properly, respecting quoted fields
    const rows = parseCSVRows(normalizedCsv);

    // Validate CSV structure and get headers
    const headers = validateCsvStructure(rows);

    // Parse manga entries
    const manga: KenmeiManga[] = [];

    // Skip the header row
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (shouldSkipRow(values, headers, i)) continue;

      const entry = createEntryMapping(headers, values);
      const fieldValues = extractFieldValues(entry);
      manga.push(createMangaEntry(entry, fieldValues));
    }

    // Process validation if enabled
    processValidationResults(manga, parseOptions);

    // Create the export object
    const kenmeiExport: KenmeiExport = {
      export_date: new Date().toISOString(),
      user: {
        username: "CSV Import User",
        id: 0,
      },
      manga,
    };

    console.info(
      `[KenmeiParser] ✅ Successfully parsed ${manga.length} manga entries from CSV`,
    );
    return kenmeiExport;
  } catch (error) {
    if (error instanceof Error) {
      console.error("[KenmeiParser] ❌ CSV parsing error:", error.message);
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
    console.error("[KenmeiParser] ❌ Unknown CSV parsing error");
    throw new Error("Failed to parse CSV: Unknown error");
  }
};

/**
 * Parse CSV content into rows and columns, properly handling quoted fields
 * @param csvContent The CSV content as a string
 * @returns Array of arrays, where each inner array contains the values for a row
 */
function parseCSVRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue: string = "";
  let inQuotes: boolean = false;

  // Process each character in the CSV
  let i = 0;
  while (i < csvContent.length) {
    const char = csvContent[i];
    const nextChar = i < csvContent.length - 1 ? csvContent[i + 1] : "";

    // Handle quotes
    if (char === '"') {
      // If this is an escaped quote (i.e., "")
      if (nextChar === '"') {
        currentValue += '"';
        i += 2; // Skip both quotes
      } else {
        // Toggle in-quotes state
        inQuotes = !inQuotes;
        i++;
      }
    }
    // Handle commas
    else if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      i++;
    }
    // Handle newlines
    else if (char === "\n" && !inQuotes) {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      i++;
    }
    // Handle all other characters
    else {
      currentValue += char;
      i++;
    }
  }

  // Add the last value and row if there is one
  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Map a Kenmei status string to a valid status enum
 * @param status Input status string
 * @returns Normalized KenmeiStatus
 */
function validateStatus(status: string | undefined): KenmeiStatus {
  // Handle undefined or empty status
  if (!status) return "reading";

  const normalized = status.trim().toLowerCase().replaceAll(" ", "_");
  const valid = new Set<KenmeiStatus>([
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_read",
  ]);
  if (valid.has(normalized as KenmeiStatus)) return normalized as KenmeiStatus;

  switch (normalized) {
    case "planning":
    case "plan":
      return "plan_to_read";
    case "hold":
    case "paused":
      return "on_hold";
    case "complete":
    case "finished":
      return "completed";
    case "read":
    case "current":
      return "reading";
    default:
      return "reading";
  }
}

/**
 * Extract unique metadata from manga entries.
 * Useful for analyzing the dataset and providing statistics.
 *
 * @param manga - Array of KenmeiManga entries.
 * @returns Object containing total manga, status counts, volume data, average score, and total chapters read.
 * @source
 */
export function extractMangaMetadata(manga: KenmeiManga[]): {
  totalManga: number;
  statusCounts: Record<KenmeiStatus, number>;
  hasVolumes: boolean;
  averageScore: number;
  totalChaptersRead: number;
} {
  const statusCounts: Record<KenmeiStatus, number> = {
    reading: 0,
    completed: 0,
    on_hold: 0,
    dropped: 0,
    plan_to_read: 0,
  };

  let totalScore = 0;
  let scoredEntries = 0;
  let totalChaptersRead = 0;
  let hasVolumesData = false;

  for (const entry of manga) {
    // Count statuses
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;

    if (entry.score > 0) {
      totalScore += entry.score;
      scoredEntries++;
    }

    totalChaptersRead += entry.chapters_read ?? 0;

    if (entry.volumes_read !== undefined || entry.total_volumes !== undefined)
      hasVolumesData = true;
  }

  return {
    totalManga: manga.length,
    statusCounts,
    hasVolumes: hasVolumesData,
    averageScore: scoredEntries > 0 ? totalScore / scoredEntries : 0,
    totalChaptersRead,
  };
}
