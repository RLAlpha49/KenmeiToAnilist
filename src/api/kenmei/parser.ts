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

    // Validate the structure of the data
    if (parseOptions.validateStructure) {
      if (!data.manga || !Array.isArray(data.manga)) {
        throw new Error(
          "Invalid Kenmei export: missing or invalid manga array",
        );
      }

      // Validate each manga entry
      data.manga.forEach((manga: KenmeiManga, index: number) => {
        if (!manga.title) {
          throw new Error(`Manga at index ${index} is missing a title`);
        }

        if (!manga.status || !isValidStatus(manga.status)) {
          manga.status = parseOptions.defaultStatus;
        }

        if (typeof manga.chapters_read !== "number") {
          manga.chapters_read = 0;
        }
      });
    }

    return data as KenmeiExport;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format in export file");
    }
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
    status: manga.status || defaultStatus,
    chapters_read:
      typeof manga.chapters_read === "number" ? manga.chapters_read : 0,
    score: typeof manga.score === "number" ? manga.score : 0,
    id: manga.id || index,
    url: manga.url || "",
    created_at: manga.created_at || new Date().toISOString(),
    updated_at: manga.updated_at || new Date().toISOString(),
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
  } catch (error) {
    if (error instanceof Error) {
      validationErrors.push({
        mangaTitle: manga.title || `Unknown manga at index ${index}`,
        field: "general",
        message: error.message,
        index,
      });
    }

    // If we allow partial data, continue processing despite errors
    if (parseOptions.allowPartialData && manga.title) {
      const defaultManga = createDefaultMangaEntry(
        manga,
        index,
        parseOptions.defaultStatus,
      );
      processedEntries.push(defaultManga);
    }
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

  // Process in batches
  for (let i = 0; i < mangaList.length; i += batchSize) {
    const batch = mangaList.slice(i, i + batchSize);

    // Process each manga in the batch
    for (let j = 0; j < batch.length; j++) {
      const manga = batch[j];
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

  // Check required fields
  if (!manga.title) {
    errors.push("Missing title");
  }

  // Validate status
  if (!manga.status || !isValidStatus(manga.status)) {
    manga.status = options.defaultStatus;
  }

  // Normalize numeric fields
  manga.chapters_read =
    typeof manga.chapters_read === "number" ? manga.chapters_read : 0;
  manga.volumes_read =
    typeof manga.volumes_read === "number" ? manga.volumes_read : 0;
  manga.score = typeof manga.score === "number" ? manga.score : 0;

  // Ensure we have dates
  manga.created_at = manga.created_at || new Date().toISOString();
  manga.updated_at = manga.updated_at || new Date().toISOString();

  // If we have critical errors and don't allow partial data, throw
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
  return [
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_read",
  ].includes(status);
}

/**
 * Validate CSV data structure and headers
 */
function validateCsvStructure(rows: string[][]): string[] {
  if (rows.length < 2) {
    throw new Error("CSV file does not contain enough data");
  }

  // Get headers from the first line, normalize them to avoid issues with spaces or case
  const headers = rows[0].map((header) => header.trim().toLowerCase());

  // Validate required headers
  const requiredHeaders = ["title"];
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(`CSV is missing required header: ${required}`);
    }
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
  // Skip rows that don't have enough fields (likely incomplete/malformed data)
  if (values.length < 2) {
    console.warn(
      `Skipping row ${rowIndex + 1} with insufficient fields: ${values.join(",")}`,
    );
    return true;
  }

  // Skip rows where the title is just a number or looks like a chapter reference
  const potentialTitle = values[headers.indexOf("title")];
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
  headers.forEach((header, index) => {
    if (index < values.length) {
      entry[header] = values[index];
    }
  });
  return entry;
}

/**
 * Parse numeric values safely
 */
function parseIntSafe(value: string | undefined): number | undefined {
  if (!value) return undefined;
  // Remove any non-numeric characters except decimal point
  const cleanValue = value.replace(/[^\d.]/g, "");
  if (!cleanValue) return undefined;
  const parsed = Number.parseInt(cleanValue, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Find a value using flexible column mappings
 */
function findValue(
  entry: Record<string, string>,
  mappings: string[],
): string | undefined {
  for (const mapping of mappings) {
    if (entry[mapping] !== undefined) {
      return entry[mapping];
    }
  }
  return undefined;
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
  const chaptersRead = parseIntSafe(fieldValues.chapterValue);
  const volumesRead = parseIntSafe(fieldValues.volumeValue);

  // Convert to proper types
  return {
    id: Number.parseInt(entry.id || "0"),
    title: entry.title,
    status: validateStatus(fieldValues.statusValue),
    score: fieldValues.scoreValue ? parseFloat(fieldValues.scoreValue) : 0,
    url: fieldValues.urlValue || "",
    cover_url: entry.cover_url,
    chapters_read: chaptersRead ?? 0,
    total_chapters: entry.total_chapters
      ? Number.parseInt(entry.total_chapters)
      : undefined,
    volumes_read: volumesRead,
    total_volumes: entry.total_volumes
      ? Number.parseInt(entry.total_volumes)
      : undefined,
    notes: fieldValues.notesValue || "",
    last_read_at: fieldValues.lastReadAt,
    created_at:
      entry.created_at || fieldValues.dateValue || new Date().toISOString(),
    updated_at:
      entry.updated_at || fieldValues.dateValue || new Date().toISOString(),
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

  // Use the processed entries if we have them
  if (result.processedEntries.length > 0) {
    manga.length = 0; // Clear the array
    manga.push(...result.processedEntries);
  }
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
    // Replace Windows line breaks with Unix style
    const normalizedCsv = csvString.replace(/\r\n/g, "\n");

    // Parse CSV rows properly, respecting quoted fields
    const rows = parseCSVRows(normalizedCsv);

    // Validate CSV structure and get headers
    const headers = validateCsvStructure(rows);

    // Parse manga entries
    const manga: KenmeiManga[] = [];

    // Skip the header row
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];

      // Skip invalid rows
      if (shouldSkipRow(values, headers, i)) {
        continue;
      }

      // Create entry mapping from headers and values
      const entry = createEntryMapping(headers, values);

      // Extract all field values
      const fieldValues = extractFieldValues(entry);

      // Create manga entry
      const mangaEntry = createMangaEntry(entry, fieldValues);
      manga.push(mangaEntry);
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

    console.log(`Successfully parsed ${manga.length} manga entries from CSV`);
    return kenmeiExport;
  } catch (error) {
    if (error instanceof Error) {
      console.error("CSV parsing error:", error.message);
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
    console.error("Unknown CSV parsing error");
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
  if (!status) {
    return "reading";
  }

  const validStatuses: KenmeiStatus[] = [
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_read",
  ];
  const normalized = status.toLowerCase().replace(" ", "_");

  if (validStatuses.includes(normalized as KenmeiStatus)) {
    return normalized as KenmeiStatus;
  }

  // Map common variations
  if (normalized === "planning" || normalized === "plan") return "plan_to_read";
  if (normalized === "hold" || normalized === "paused") return "on_hold";
  if (normalized === "complete" || normalized === "finished")
    return "completed";
  if (normalized === "read" || normalized === "current") return "reading";

  // Default if no match
  return "reading";
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

  manga.forEach((entry) => {
    // Count statuses
    statusCounts[entry.status]++;

    // Track scores
    if (entry.score > 0) {
      totalScore += entry.score;
      scoredEntries++;
    }

    // Track chapters
    totalChaptersRead += entry.chapters_read || 0;

    // Check if we have volume data
    if (entry.volumes_read !== undefined || entry.total_volumes !== undefined) {
      hasVolumesData = true;
    }
  });

  return {
    totalManga: manga.length,
    statusCounts,
    hasVolumes: hasVolumesData,
    averageScore: scoredEntries > 0 ? totalScore / scoredEntries : 0,
    totalChaptersRead,
  };
}
