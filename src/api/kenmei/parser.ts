/**
 * Parser for Kenmei export files
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
 * Parse a Kenmei export file
 * @param fileContent The content of the Kenmei export file as text
 * @param options Parsing options
 * @returns Parsed Kenmei data
 * @throws Error if the file cannot be parsed
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
 * Process Kenmei manga list in batches
 * @param mangaList List of manga to process
 * @param batchSize Size of each batch
 * @param options Processing options
 * @returns Processing results
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
          processedEntries.push({
            ...manga,
            status: manga.status || parseOptions.defaultStatus,
            chapters_read:
              typeof manga.chapters_read === "number" ? manga.chapters_read : 0,
            score: typeof manga.score === "number" ? manga.score : 0,
            id: manga.id || index,
            url: manga.url || "",
            created_at: manga.created_at || new Date().toISOString(),
            updated_at: manga.updated_at || new Date().toISOString(),
          });
        }
      }
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
 * Parse a Kenmei CSV export file
 * @param csvString The content of the CSV file
 * @param options Parsing options
 * @returns Parsed Kenmei data
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

    // Create mapping for various possible column names
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

    // Parse manga entries
    const manga: KenmeiManga[] = [];

    // Skip the header row
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];

      // Skip rows that don't have enough fields (likely incomplete/malformed data)
      if (values.length < 2) {
        console.warn(
          `Skipping row ${i + 1} with insufficient fields: ${values.join(",")}`,
        );
        continue;
      }

      // Skip rows where the title is just a number or looks like a chapter reference
      const potentialTitle = values[headers.indexOf("title")];
      if (
        /^(Chapter|Ch\.|Vol\.|Volume) \d+$/i.test(potentialTitle) ||
        /^\d+$/.test(potentialTitle)
      ) {
        console.warn(
          `Skipping row ${i + 1} with invalid title: "${potentialTitle}"`,
        );
        continue;
      }

      // Create an object mapping headers to values
      const entry: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          entry[header] = values[index];
        }
      });

      // Find values using flexible column names
      const findValue = (mappings: string[]): string | undefined => {
        for (const mapping of mappings) {
          if (entry[mapping] !== undefined) {
            return entry[mapping];
          }
        }
        return undefined;
      };

      // Parse numeric values safely
      const parseIntSafe = (value: string | undefined): number | undefined => {
        if (!value) return undefined;
        // Remove any non-numeric characters except decimal point
        const cleanValue = value.replace(/[^\d.]/g, "");
        if (!cleanValue) return undefined;
        const parsed = parseInt(cleanValue, 10);
        return isNaN(parsed) ? undefined : parsed;
      };

      // Get values using flexible column mappings
      const chapterValue = findValue(columnMappings.chapter);
      const volumeValue = findValue(columnMappings.volume);
      const statusValue = findValue(columnMappings.status);
      const scoreValue = findValue(columnMappings.score);
      const urlValue = findValue(columnMappings.url);
      const notesValue = findValue(columnMappings.notes);
      const dateValue = findValue(columnMappings.date);

      // Parse chapter and volume numbers
      const chaptersRead = parseIntSafe(chapterValue);
      const volumesRead = parseIntSafe(volumeValue);

      // Convert to proper types
      const mangaEntry: KenmeiManga = {
        id: parseInt(entry.id || "0"),
        title: entry.title,
        status: validateStatus(statusValue),
        score: scoreValue ? parseFloat(scoreValue) : 0,
        url: urlValue || "",
        cover_url: entry.cover_url,
        chapters_read: chaptersRead !== undefined ? chaptersRead : 0,
        total_chapters: entry.total_chapters
          ? parseInt(entry.total_chapters)
          : undefined,
        volumes_read: volumesRead,
        total_volumes: entry.total_volumes
          ? parseInt(entry.total_volumes)
          : undefined,
        notes: notesValue || "",
        created_at: dateValue || new Date().toISOString(),
        updated_at: dateValue || new Date().toISOString(),
        author: entry.author,
        alternative_titles: entry.alternative_titles
          ? entry.alternative_titles.split(";")
          : undefined,
      };

      manga.push(mangaEntry);
    }

    // Process in batches if needed and validation is enabled
    if (parseOptions.validateStructure) {
      const result = processKenmeiMangaBatches(manga, 100, parseOptions);

      if (
        result.validationErrors.length > 0 &&
        !parseOptions.allowPartialData
      ) {
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
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = i < csvContent.length - 1 ? csvContent[i + 1] : "";

    // Handle quotes
    if (char === '"') {
      // If this is an escaped quote (i.e., "")
      if (nextChar === '"') {
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Toggle in-quotes state
        inQuotes = !inQuotes;
      }
    }
    // Handle commas
    else if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
    }
    // Handle newlines
    else if (char === "\n" && !inQuotes) {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
    }
    // Handle all other characters
    else {
      currentValue += char;
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
 * Extract unique metadata from manga entries
 * This is useful for analyzing the dataset and providing statistics
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
