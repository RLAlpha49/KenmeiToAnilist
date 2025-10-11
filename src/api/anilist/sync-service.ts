/**
 * @packageDocumentation
 * @module anilist-sync-service
 * @description AniList Synchronization Service. Handles batch updates, deletions, retries, and synchronization with AniList API.
 */

import { request } from "./client";
import {
  DELETE_MANGA_ENTRY,
  generateUpdateMangaEntryMutation,
} from "./mutations";
import { AniListMediaEntry } from "./types";
import { storage, STORAGE_KEYS } from "../../utils/storage";

// Type alias for GraphQL variables
type GraphQLVariables = Record<string, string | number | boolean>;

/**
 * Build variables for existing entries (only changed fields)
 */
function buildVariablesForExistingEntry(
  entry: AniListMediaEntry,
): GraphQLVariables {
  const variables: GraphQLVariables = {
    mediaId: entry.mediaId,
  };

  if (!entry.previousValues) return variables;

  // Only include fields that have changed
  if (entry.status !== entry.previousValues.status)
    variables.status = entry.status;

  if (entry.progress !== entry.previousValues.progress)
    variables.progress = entry.progress;

  if (entry.score !== entry.previousValues.score)
    variables.score = entry.score || 0;

  // Only include private flag if it's explicitly set
  if (entry.private !== undefined) variables.private = entry.private;

  return variables;
}

/**
 * Build variables for new entries (all defined fields)
 */
function buildVariablesForNewEntry(entry: AniListMediaEntry): GraphQLVariables {
  const variables: GraphQLVariables = {
    mediaId: entry.mediaId,
    status: entry.status,
  };

  if (typeof entry.progress === "number" && entry.progress >= 0)
    variables.progress = entry.progress;

  if (typeof entry.score === "number" && entry.score >= 0)
    variables.score = entry.score;

  if (entry.private !== undefined) variables.private = entry.private;

  return variables;
}

/**
 * Handle incremental sync step 1: increment progress by 1
 */
function handleIncrementalStep1(
  entry: AniListMediaEntry,
  operationId: string,
): GraphQLVariables {
  const previousProgress = entry.previousValues?.progress || 0;
  const variables = {
    mediaId: entry.mediaId,
    progress: previousProgress + 1,
  };

  console.debug(
    `[AniListSync] 📊 [${operationId}] Incremental sync step 1: Updating progress from ${previousProgress} to ${variables.progress} (incrementing by 1)`,
  );

  return variables;
}

/**
 * Handle incremental sync step 2: set progress to final value
 */
function handleIncrementalStep2(
  entry: AniListMediaEntry,
  operationId: string,
): GraphQLVariables {
  const variables = {
    mediaId: entry.mediaId,
    progress: entry.progress,
  };

  console.debug(
    `[AniListSync] 📊 [${operationId}] Incremental sync step 2: Updating progress to final value ${entry.progress}`,
  );

  return variables;
}

/**
 * Build variables for incremental step 3 - new entries
 */
function buildStep3VariablesForNewEntry(
  entry: AniListMediaEntry,
): GraphQLVariables {
  const variables: GraphQLVariables = {
    mediaId: entry.mediaId,
  };

  if (entry.status) variables.status = entry.status;

  // Include score for new entries if it has a value
  if (typeof entry.score === "number" && entry.score > 0)
    variables.score = entry.score;

  // Include private flag if set
  if (entry.private !== undefined) variables.private = entry.private;

  return variables;
}

/**
 * Build variables for incremental step 3 - existing entries
 */
function buildStep3VariablesForExistingEntry(
  entry: AniListMediaEntry,
): GraphQLVariables {
  const variables: GraphQLVariables = {
    mediaId: entry.mediaId,
  };

  // For existing entries, only include status if it's changed
  if (entry.status !== entry.previousValues!.status)
    variables.status = entry.status;

  // Include score if available and changed
  if (
    entry.score !== entry.previousValues!.score &&
    typeof entry.score === "number" &&
    entry.score >= 0
  )
    variables.score = entry.score;

  // Include private flag if set
  if (entry.private !== undefined) variables.private = entry.private;

  return variables;
}

/**
 * Handle incremental sync step 3: update status and score
 */
function handleIncrementalStep3(
  entry: AniListMediaEntry,
  operationId: string,
): GraphQLVariables {
  // Build variables based on entry type
  const variables = entry.previousValues
    ? buildStep3VariablesForExistingEntry(entry)
    : buildStep3VariablesForNewEntry(entry);

  // Build info string for logging
  const changes = [];
  if (variables.status) changes.push(`status to ${variables.status}`);
  if (variables.score) changes.push(`score to ${variables.score}`);
  if (variables.private !== undefined)
    changes.push(`private to ${variables.private}`);

  const updateInfo =
    changes.length > 0 ? changes.join(", ") : "no additional fields";
  console.debug(
    `[AniListSync] 📊 [${operationId}] Incremental sync step 3: Updating ${updateInfo}`,
  );

  return variables;
}

/**
 * Apply incremental sync step modifications to variables
 */
function applyIncrementalSyncStep(
  entry: AniListMediaEntry,
  variables: GraphQLVariables,
  operationId: string,
): GraphQLVariables {
  const step = entry.syncMetadata?.step;
  if (!step) return variables;

  switch (step) {
    case 1:
      return handleIncrementalStep1(entry, operationId);
    case 2:
      return handleIncrementalStep2(entry, operationId);
    case 3:
      return handleIncrementalStep3(entry, operationId);
    default:
      return variables;
  }
}

/**
 * Extract retry-after time from GraphQL error
 */
function extractRetryAfterTime(
  errors: { extensions?: { retryAfter?: number }; message: string }[],
): number {
  const retryAfter = 60000; // Default to 60 seconds

  for (const err of errors) {
    if (err.extensions?.retryAfter)
      return Number(err.extensions.retryAfter) * 1000;

    const timeMatch = new RegExp(/(\d+)\s*(?:second|sec|s)/i).exec(err.message);
    if (timeMatch?.[1]) return Number(timeMatch[1]) * 1000;
  }

  return retryAfter;
}

/**
 * Check if GraphQL errors indicate rate limiting
 */
function isRateLimitError(errors: { message: string }[]): boolean {
  return errors.some(
    (err) =>
      err.message.toLowerCase().includes("rate limit") ||
      err.message.toLowerCase().includes("too many requests"),
  );
}

/**
 * Handle GraphQL errors and return appropriate SyncResult
 */
function handleGraphQLErrors(
  errors: { extensions?: { retryAfter?: number }; message: string }[],
  mediaId: number,
  operationId: string,
): SyncResult {
  const errorMessages = errors.map((err) => err.message).join(", ");
  console.error(`[AniListSync] ❌ [${operationId}] GraphQL errors:`, errors);

  if (isRateLimitError(errors)) {
    const retryAfter = extractRetryAfterTime(errors);
    console.warn(
      `[AniListSync] ⚠️ [${operationId}] Rate limited! Will retry after ${retryAfter / 1000} seconds`,
    );

    return {
      success: false,
      mediaId,
      error: `Rate limited: ${errorMessages}`,
      rateLimited: true,
      retryAfter,
    };
  }

  return {
    success: false,
    mediaId,
    error: `GraphQL error: ${errorMessages}`,
    rateLimited: false,
    retryAfter: null,
  };
}

/**
 * Handle response data extraction and validation
 */
function handleResponseData(
  response: {
    data?: {
      data?: { SaveMediaListEntry?: { id: number } };
      SaveMediaListEntry?: { id: number };
    };
  },
  mediaId: number,
  operationId: string,
): SyncResult {
  const responseData = response.data?.data ?? response.data;

  if (responseData?.SaveMediaListEntry?.id) {
    console.debug(
      `[AniListSync] ✅ [${operationId}] Successfully updated entry with ID ${mediaId}`,
    );
    return {
      success: true,
      mediaId,
      entryId: responseData.SaveMediaListEntry.id,
      rateLimited: false,
      retryAfter: null,
    };
  }

  console.error(
    `❌ [${operationId}] Missing SaveMediaListEntry in response:`,
    JSON.stringify(response, null, 2),
  );
  return {
    success: false,
    mediaId,
    error: "Update failed: No entry ID returned in response",
    rateLimited: false,
    retryAfter: null,
  };
}

/**
 * Check if error is a 500 server error
 */
function is500ServerError(error: unknown, errorMessage: string): boolean {
  if (error instanceof Error) {
    if (
      error.message.includes("500") ||
      error.message.includes("Internal Server Error")
    )
      return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 500
  )
    return true;

  if (typeof errorMessage === "string") {
    try {
      if (
        errorMessage.includes('"status": 500') ||
        errorMessage.includes('"status":500') ||
        errorMessage.includes("Internal Server Error")
      )
        return true;
    } catch {
      // Ignore parsing errors
    }
  }

  return false;
}

/**
 * Log detailed error information
 */
function logErrorDetails(
  error: unknown,
  entry: AniListMediaEntry,
  operationId: string,
): void {
  console.error(
    `[AniListSync] ❌ [${operationId}] Error updating entry ${entry.mediaId}:`,
    error,
  );

  if (error instanceof Error) {
    console.error(
      `[AniListSync]    [${operationId}] Error type: ${error.name}`,
    );
    console.error(
      `[AniListSync]    [${operationId}] Error message: ${error.message}`,
    );
    console.error(
      `[AniListSync]    [${operationId}] Stack trace:`,
      error.stack || "No stack trace available",
    );

    if (error instanceof TypeError && error.message.includes("fetch"))
      console.error(
        `[AniListSync]    [${operationId}] Network error detected. Possible connectivity issue.`,
      );
  }

  console.error(`[AniListSync]    [${operationId}] Entry details:`, {
    mediaId: entry.mediaId,
    title: entry.title,
    status: entry.status,
    progress: entry.progress,
    score: entry.score,
  });
}

/**
 * Handle exception errors during update
 */
function handleUpdateError(
  error: unknown,
  entry: AniListMediaEntry,
  operationId: string,
): SyncResult {
  const errorMessage =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  logErrorDetails(error, entry, operationId);

  if (is500ServerError(error, errorMessage)) {
    console.warn(
      `⚠️ [${operationId}] 500 Server Error detected. Will perform automatic retry.`,
    );

    const retryDelay = 3000;
    return {
      success: false,
      mediaId: entry.mediaId,
      error: `Server Error (500): ${errorMessage}. Automatic retry scheduled.`,
      rateLimited: true,
      retryAfter: retryDelay,
    };
  }

  return {
    success: false,
    mediaId: entry.mediaId,
    error: errorMessage,
    rateLimited: false,
    retryAfter: null,
  };
}

// Rate limiting constants
const MAX_REQUESTS_PER_MINUTE = 28;
const REQUEST_INTERVAL = 60000 / MAX_REQUESTS_PER_MINUTE; // Time between requests

/**
 * Result of a single manga sync/update operation.
 *
 * @source
 */
export interface SyncResult {
  success: boolean;
  mediaId: number;
  error?: string;
  entryId?: number;
  rateLimited: boolean;
  retryAfter: number | null;
}

/**
 * Progress information for a batch sync operation.
 *
 * @source
 */
export interface SyncProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentEntry: {
    mediaId: number;
    title: string;
    coverImage: string;
  } | null;
  currentStep: number | null;
  totalSteps: number | null;
  rateLimited: boolean;
  retryAfter: number | null;
}

/**
 * Report for a completed sync batch.
 *
 * @source
 */
export interface SyncReport {
  totalEntries: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedEntries: number;
  errors: {
    mediaId: number;
    error: string;
  }[];
  timestamp: Date;
}

/**
 * Update a single manga entry in AniList.
 *
 * @param entry - The AniList media entry to update.
 * @param token - The user's authentication token.
 * @returns A promise resolving to a SyncResult object.
 * @source
 */
export async function updateMangaEntry(
  entry: AniListMediaEntry,
  token: string,
): Promise<SyncResult> {
  // Generate an operation ID for tracking in logs early
  const operationId = `${entry.mediaId}-${Date.now().toString(36).substring(4, 10)}`;

  if (!token) {
    console.error(
      `[AniListSync] ❌ [${operationId}] No authentication token provided`,
    );
    return {
      success: false,
      mediaId: entry.mediaId,
      error: "No authentication token provided",
      rateLimited: false,
      retryAfter: null,
    };
  }

  try {
    // Build variables based on entry type (existing vs new)
    let variables = entry.previousValues
      ? buildVariablesForExistingEntry(entry)
      : buildVariablesForNewEntry(entry);

    // Apply incremental sync modifications if needed
    variables = applyIncrementalSyncStep(entry, variables, operationId);

    // Generate a dynamic mutation with only the needed variables
    const mutation = generateUpdateMangaEntryMutation(variables);

    // Define the expected response structure to handle both direct and nested formats
    interface SaveMediaListEntryData {
      SaveMediaListEntry?: {
        id: number;
        status: string;
        progress: number;
        private: boolean;
        score: number;
      };
      data?: {
        SaveMediaListEntry?: {
          id: number;
          status: string;
          progress: number;
          private: boolean;
          score: number;
        };
      };
    }

    // Make the API request with optimized variables and mutation
    const response = await request<SaveMediaListEntryData>(
      mutation,
      variables,
      token,
    );

    // Check for GraphQL errors
    if (response.errors && response.errors.length > 0) {
      return handleGraphQLErrors(response.errors, entry.mediaId, operationId);
    }

    // Handle response data
    return handleResponseData(response, entry.mediaId, operationId);
  } catch (error) {
    // Handle exception errors
    return handleUpdateError(error, entry, operationId);
  }
}

/**
 * Delete a manga entry in AniList.
 *
 * @param entryId - The AniList entry ID to delete.
 * @param token - The user's authentication token.
 * @returns A promise resolving to an object indicating success or error.
 * @source
 */
export async function deleteMangaEntry(
  entryId: number,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  // Generate an operation ID for tracking in logs
  const operationId = `del-${entryId}-${Date.now().toString(36).substring(4, 10)}`;

  console.info(
    `[AniListSync] 🗑️ [${operationId}] Starting delete operation for entry ID ${entryId}`,
  );

  if (!token) {
    console.error(
      `[AniListSync] ❌ [${operationId}] No authentication token provided`,
    );
    return {
      success: false,
      error: "No authentication token provided",
    };
  }

  try {
    const variables = {
      id: entryId,
    };

    // Define the expected response structure
    interface DeleteMediaListEntryData {
      DeleteMediaListEntry?: {
        deleted: boolean;
      };
      data?: {
        DeleteMediaListEntry?: {
          deleted: boolean;
        };
      };
    }

    const response = await request<DeleteMediaListEntryData>(
      DELETE_MANGA_ENTRY,
      variables,
      token,
    );

    // Check for GraphQL errors
    if (response.errors && response.errors.length > 0) {
      const errorMessages = response.errors
        .map((err) => err.message)
        .join(", ");
      console.error(
        `❌ [${operationId}] GraphQL errors for delete operation:`,
        response.errors,
      );
      return {
        success: false,
        error: `GraphQL error: ${errorMessages}`,
      };
    }

    // Handle nested response structure
    const responseData = response.data?.data ?? response.data;

    if (responseData?.DeleteMediaListEntry?.deleted) {
      console.info(
        `[AniListSync] ✅ [${operationId}] Successfully deleted entry with ID ${entryId}`,
      );
      return {
        success: true,
      };
    }

    console.error(
      `[AniListSync] ❌ [${operationId}] Missing DeleteMediaListEntry in response:`,
      JSON.stringify(response, null, 2),
    );
    return {
      success: false,
      error: "Delete failed: Entry was not deleted",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ [${operationId}] Error deleting manga entry ${entryId}:`,
      error,
    );

    // Try to get more detailed information from the error object
    if (error instanceof Error) {
      console.error(
        `[AniListSync]    [${operationId}] Error type: ${error.name}`,
      );
      console.error(
        `[AniListSync]    [${operationId}] Error message: ${error.message}`,
      );
      console.error(
        `[AniListSync]    [${operationId}] Stack trace:`,
        error.stack || "No stack trace available",
      );
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Calculate incremental steps for new entries (no previous values)
 * @param entry - The AniList media entry
 * @returns Array of step numbers to execute
 */
function calculateNewEntrySteps(entry: AniListMediaEntry): number[] {
  const steps: number[] = [];
  const targetProgress = entry.progress;
  const hasMetadata =
    entry.status || entry.score || entry.private !== undefined;

  // For new entries with progress > 1, use incremental steps
  if (targetProgress > 1)
    steps.push(1, 2); // Step 1: progress = 1, Step 2: progress = target
  else if (targetProgress === 1) steps.push(1); // Step 1: progress = 1

  // Always include step 3 for new entries to set status and other metadata
  if (hasMetadata) steps.push(3);

  // If no progress and no metadata, just add everything in one step
  if (steps.length === 0) steps.push(1);

  return steps;
}

/**
 * Calculate incremental steps for existing entries with previous values
 * @param entry - The AniList media entry
 * @returns Array of step numbers to execute
 */
function calculateExistingEntrySteps(entry: AniListMediaEntry): number[] {
  const steps: number[] = [];
  const prev = entry.previousValues!;

  const progressChanged = entry.progress !== prev.progress;
  const progressDelta = entry.progress - prev.progress;
  const metadataChanged =
    entry.status !== prev.status ||
    entry.score !== prev.score ||
    entry.private !== prev.private;

  // Add progress steps based on change amount
  if (progressChanged) {
    if (progressDelta === 1) steps.push(1);
    else if (progressDelta > 1) steps.push(1, 2);
  }

  // Add metadata step if needed
  if (metadataChanged) {
    if (progressChanged) {
      // Both progress and metadata changed
      addMetadataStepForBothChanged(steps, progressDelta);
    } else {
      // Only metadata changed
      steps.push(3);
    }
  }

  return steps;
}

/**
 * Helper to add metadata step when both progress and metadata changed
 * @param steps - Current steps array to modify
 * @param progressDelta - Amount progress changed
 */
function addMetadataStepForBothChanged(
  steps: number[],
  progressDelta: number,
): void {
  // Ensure progress steps are included
  if (progressDelta === 1) {
    if (!steps.includes(1)) steps.push(1);
  } else if (progressDelta > 1) {
    if (!steps.includes(1)) steps.push(1);
    if (!steps.includes(2)) steps.push(2);
  }

  // Always add metadata step
  steps.push(3);
}

function getIncrementalSteps(entry: AniListMediaEntry): number[] {
  const prev = entry.previousValues;

  // For new entries (no previousValues)
  if (!prev) {
    const steps = calculateNewEntrySteps(entry);
    const resumeFromStep = entry.syncMetadata?.resumeFromStep;
    return resumeFromStep
      ? steps.filter((step) => step >= resumeFromStep)
      : steps;
  }

  // For existing entries (original logic)
  const steps = calculateExistingEntrySteps(entry);
  const resumeFromStep = entry.syncMetadata?.resumeFromStep;
  return resumeFromStep
    ? steps.filter((step) => step >= resumeFromStep)
    : steps;
}

/**
 * Helper function to handle rate limiting with retry countdown
 * @param progress - Current sync progress
 * @param result - Sync result with rate limit info
 * @param onProgress - Progress callback function
 * @param abortSignal - Abort signal for cancellation
 * @returns Promise that resolves when retry delay is complete
 */
async function handleRateLimitRetry(
  progress: SyncProgress,
  result: SyncResult,
  onProgress?: (progress: SyncProgress) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  const retryAfterMs = result.retryAfter!;

  progress.rateLimited = true;
  progress.retryAfter = retryAfterMs;

  if (onProgress) {
    console.warn(`[AniListSync] ⏳ Rate limited: retryAfter=${retryAfterMs}ms`);
    onProgress({ ...progress });
  }

  const startTime = Date.now();
  const endTime = startTime + retryAfterMs;

  const countdownInterval = setInterval(() => {
    const currentTime = Date.now();
    const remainingMs = Math.max(0, endTime - currentTime);
    progress.retryAfter = remainingMs;

    if (onProgress) onProgress({ ...progress });

    if (remainingMs <= 0 || abortSignal?.aborted)
      clearInterval(countdownInterval);
  }, 1000);

  await new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => {
      clearInterval(countdownInterval);
      progress.rateLimited = false;
      progress.retryAfter = null;

      if (onProgress) onProgress({ ...progress });

      resolve();
    }, retryAfterMs);

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        clearInterval(countdownInterval);
        resolve();
      });
    }
  });
}

/**
 * Organize entries by media ID for handling incremental sync properly
 * @param entries - Array of AniList media entries to sync
 * @returns Object mapping media IDs to their entry arrays
 */
function organizeEntriesByMediaId(
  entries: AniListMediaEntry[],
): Record<number, AniListMediaEntry[]> {
  const entriesByMediaId: Record<number, AniListMediaEntry[]> = {};

  for (const entry of entries) {
    if (!entriesByMediaId[entry.mediaId]) entriesByMediaId[entry.mediaId] = [];

    if (entry.syncMetadata?.useIncrementalSync) {
      const steps = getIncrementalSteps(entry);
      for (const step of steps) {
        const stepEntry = { ...entry };
        stepEntry.syncMetadata = {
          ...entry.syncMetadata,
          step: step,
        };
        entriesByMediaId[entry.mediaId].push(stepEntry);
      }
    } else {
      entriesByMediaId[entry.mediaId].push(entry);
    }
  }

  return entriesByMediaId;
}

/**
 * Determine the order of media IDs to process
 * @param displayOrderMediaIds - Optional user-specified order
 * @param entriesByMediaId - Organized entries by media ID
 * @returns Array of media IDs in processing order
 */
function determineProcessingOrder(
  displayOrderMediaIds: number[] | undefined,
  entriesByMediaId: Record<number, AniListMediaEntry[]>,
): number[] {
  return displayOrderMediaIds && displayOrderMediaIds.length > 0
    ? displayOrderMediaIds
    : Object.keys(entriesByMediaId).map(Number);
}

/**
 * Setup progress tracking for a specific media entry
 * @param mediaIdNum - Current media ID being processed
 * @param entriesForMediaId - Entries for this media ID
 * @param progress - Current sync progress object to update
 */
function setupProgressForMedia(
  mediaIdNum: number,
  entriesForMediaId: AniListMediaEntry[],
  progress: SyncProgress,
): { isIncremental: boolean } {
  const mediaIdStr = String(mediaIdNum);
  const firstEntry = entriesForMediaId[0];
  const isIncremental =
    entriesForMediaId.length > 1 && firstEntry.syncMetadata?.useIncrementalSync;

  progress.currentEntry = {
    mediaId: Number(mediaIdStr),
    title: firstEntry.title || `Manga #${mediaIdStr}`,
    coverImage: firstEntry.coverImage || "",
  };

  if (isIncremental) {
    progress.totalSteps = entriesForMediaId.length;
  } else {
    progress.currentStep = null;
    progress.totalSteps = null;
  }

  return { isIncremental: !!isIncremental };
}

/**
 * Context object for processing entry steps
 */
interface EntryProcessingContext {
  token: string;
  apiCallsCompleted: { count: number };
  progress: SyncProgress;
  onProgress: ((progress: SyncProgress) => void) | undefined;
  abortSignal: AbortSignal | undefined;
  mediaIdStr: string;
  entriesForMediaId: AniListMediaEntry[];
}

/**
 * Process a single entry step with rate limiting and error handling
 * @param entry - Current entry to process
 * @param entryIndex - Index in the entries array
 * @param isIncremental - Whether this is incremental sync
 * @param context - Processing context with shared data
 * @returns Promise resolving to processing result
 */
async function processEntryStep(
  entry: AniListMediaEntry,
  entryIndex: number,
  isIncremental: boolean,
  context: EntryProcessingContext,
): Promise<{ success: boolean; error?: string; shouldRetry: boolean }> {
  // Update progress step
  if (isIncremental)
    context.progress.currentStep = entry.syncMetadata?.step || entryIndex + 1;

  if (context.onProgress) {
    console.debug(
      `[AniListSync] 📊 Progress update: completed=${context.progress.completed}/${context.progress.total}, mediaId=${context.mediaIdStr}, step=${context.progress.currentStep}, incremental=${isIncremental}`,
    );
    context.onProgress({ ...context.progress });
  }

  try {
    // Rate limiting delay
    if (context.apiCallsCompleted.count > 0)
      await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL));

    const result = await updateMangaEntry(entry, context.token);
    context.apiCallsCompleted.count++;

    // Handle rate limiting
    if (result.rateLimited && result.retryAfter) {
      await handleRateLimitRetry(
        context.progress,
        result,
        context.onProgress,
        context.abortSignal,
      );
      return { success: true, shouldRetry: true };
    }

    // Handle unsuccessful result
    if (!result.success)
      return {
        success: false,
        error: result.error,
        shouldRetry: false,
      };

    return { success: true, shouldRetry: false };
  } catch (error) {
    context.apiCallsCompleted.count++;
    const entryError = error instanceof Error ? error.message : String(error);
    const errorOpId = `err-${context.mediaIdStr}-${entry.syncMetadata?.step || 0}-${Date.now().toString(36).substring(4, 10)}`;

    console.error(
      `[AniListSync] ❌ [${errorOpId}] Error updating entry ${context.mediaIdStr}:`,
      error,
    );
    console.error(`[AniListSync]    [${errorOpId}] Entry details:`, {
      mediaId: entry.mediaId,
      title: entry.title,
      status: entry.status,
      progress: entry.progress,
      score: entry.score,
      incremental: isIncremental,
      step: entry.syncMetadata?.step || "N/A",
    });

    return {
      success: false,
      error: entryError,
      shouldRetry: false,
    };
  }
}

/**
 * Process all entries for a single media ID
 * @param mediaIdNum - Media ID to process
 * @param entriesByMediaId - All organized entries
 * @param token - Authentication token
 * @param apiCallsCompleted - Reference to API calls counter
 * @param progress - Current sync progress
 * @param onProgress - Progress callback function
 * @param abortSignal - Abort signal for cancellation
 * @returns Promise resolving to processing result
 */
async function processMediaEntries(
  mediaIdNum: number,
  entriesByMediaId: Record<number, AniListMediaEntry[]>,
  token: string,
  apiCallsCompleted: { count: number },
  progress: SyncProgress,
  onProgress: ((progress: SyncProgress) => void) | undefined,
  abortSignal: AbortSignal | undefined,
): Promise<{ success: boolean; error?: string }> {
  const entriesForMediaId = entriesByMediaId[mediaIdNum];
  const mediaIdStr = String(mediaIdNum);

  if (!entriesForMediaId) return { success: true }; // Skip if not present

  console.debug(
    `[AniListSync] 📚 Starting sync for manga ${mediaIdNum} (${progress.completed + 1}/${progress.total})`,
  );

  if (abortSignal?.aborted) {
    console.info("[AniListSync] ⏹️ Sync operation aborted by user");
    return { success: false, error: "Aborted by user" };
  }

  // Sort entries by step for proper incremental sync order
  entriesForMediaId.sort((a: AniListMediaEntry, b: AniListMediaEntry) => {
    const stepA = a.syncMetadata?.step || 0;
    const stepB = b.syncMetadata?.step || 0;
    return stepA - stepB;
  });

  const { isIncremental } = setupProgressForMedia(
    mediaIdNum,
    entriesForMediaId,
    progress,
  );

  let entrySuccess = true;
  let entryError: string | undefined;

  // Process all entries for this media ID
  let entryIndex = 0;
  while (entryIndex < entriesForMediaId.length) {
    if (abortSignal?.aborted) {
      console.info("[AniListSync] ⏹️ Sync operation aborted by user");
      break;
    }

    const entry = entriesForMediaId[entryIndex];
    const context: EntryProcessingContext = {
      token,
      apiCallsCompleted,
      progress,
      onProgress,
      abortSignal,
      mediaIdStr,
      entriesForMediaId,
    };

    const result = await processEntryStep(
      entry,
      entryIndex,
      isIncremental,
      context,
    );

    if (result.shouldRetry) {
      // Don't increment entryIndex - retry the same entry
      continue;
    }

    if (!result.success) {
      entrySuccess = false;
      entryError = result.error;
      if (isIncremental) break; // Stop processing this media on error in incremental mode
    }

    entryIndex++;
  }

  return { success: entrySuccess, error: entryError };
}

/**
 * Generate final sync report and save statistics
 * @param entries - Original entries array
 * @param progress - Final sync progress
 * @param errors - Array of errors that occurred
 * @returns Final sync report
 */
function generateSyncReport(
  entries: AniListMediaEntry[],
  progress: SyncProgress,
  errors: { mediaId: number; error: string }[],
): SyncReport {
  const attemptedEntries =
    progress.successful + progress.failed + progress.skipped;

  const report: SyncReport = {
    totalEntries: attemptedEntries,
    successfulUpdates: progress.successful,
    failedUpdates: progress.failed,
    skippedEntries: progress.skipped,
    errors,
    timestamp: new Date(),
  };

  // Save sync statistics
  try {
    const prevStats = JSON.parse(
      storage.getItem(STORAGE_KEYS.SYNC_STATS) || "{}",
    );
    const totalSyncs = (prevStats.totalSyncs || 0) + 1;
    const entriesSynced =
      (prevStats.entriesSynced || 0) + report.successfulUpdates;
    const syncStats = {
      lastSyncTime: report.timestamp,
      entriesSynced,
      failedSyncs: report.failedUpdates,
      totalSyncs,
    };
    storage.setItem(STORAGE_KEYS.SYNC_STATS, JSON.stringify(syncStats));
  } catch (e) {
    console.error("[AniListSync] ❌ Failed to save sync stats:", e);
  }

  console.info("[AniListSync] ✅ Sync completed:", report);
  return report;
}

/**
 * Process a batch of manga updates with rate limiting and progress tracking.
 *
 * @param entries - Array of AniList media entries to sync.
 * @param token - The user's authentication token.
 * @param onProgress - Optional callback for progress updates.
 * @param abortSignal - Optional abort signal to cancel the sync.
 * @param displayOrderMediaIds - Optional array of media IDs to control sync order.
 * @returns A promise resolving to a SyncReport object.
 * @source
 */
export async function syncMangaBatch(
  entries: AniListMediaEntry[],
  token: string,
  onProgress?: (progress: SyncProgress) => void,
  abortSignal?: AbortSignal,
  displayOrderMediaIds?: number[],
): Promise<SyncReport> {
  const errors: { mediaId: number; error: string }[] = [];

  // Organize entries by media ID for handling incremental sync properly
  const entriesByMediaId = organizeEntriesByMediaId(entries);

  // Determine processing order and unique entry count
  const userOrderMediaIds = determineProcessingOrder(
    displayOrderMediaIds,
    entriesByMediaId,
  );
  const uniqueEntryCount = userOrderMediaIds.length;

  // Track progress against unique media IDs rather than incremental steps
  const progress: SyncProgress = {
    total: uniqueEntryCount,
    completed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    currentEntry: null,
    currentStep: null,
    totalSteps: null,
    rateLimited: false,
    retryAfter: null,
  };

  if (onProgress) onProgress({ ...progress });

  const apiCallsCompleted = { count: 0 };

  // Process each media ID in order
  for (const mediaIdNum of userOrderMediaIds) {
    if (abortSignal?.aborted) {
      console.info("[AniListSync] ⏹️ Sync operation aborted by user");
      break;
    }

    const result = await processMediaEntries(
      mediaIdNum,
      entriesByMediaId,
      token,
      apiCallsCompleted,
      progress,
      onProgress,
      abortSignal,
    );

    // Update progress counters
    progress.completed++;

    if (result.success) {
      progress.successful++;
    } else {
      progress.failed++;
      if (result.error)
        errors.push({
          mediaId: mediaIdNum,
          error: result.error,
        });
    }

    // Clear current entry info
    progress.currentEntry = null;
    progress.currentStep = null;

    if (onProgress) onProgress({ ...progress });
  }

  return generateSyncReport(entries, progress, errors);
}

/**
 * Retry failed updates from a previous sync.
 *
 * @param entries - Array of AniList media entries.
 * @param failedMediaIds - Array of media IDs that failed in the previous sync.
 * @param token - The user's authentication token.
 * @param onProgress - Optional callback for progress updates.
 * @param abortSignal - Optional abort signal to cancel the retry.
 * @returns A promise resolving to a SyncReport object.
 * @source
 */
export async function retryFailedUpdates(
  entries: AniListMediaEntry[],
  failedMediaIds: number[],
  token: string,
  onProgress?: (progress: SyncProgress) => void,
  abortSignal?: AbortSignal,
): Promise<SyncReport> {
  // Filter entries to only include previously failed ones
  const entriesToRetry = entries.filter((entry) =>
    failedMediaIds.includes(entry.mediaId),
  );

  console.info(
    `[AniListSync] 🔄 Retrying ${entriesToRetry.length} failed updates out of ${entries.length} total entries`,
  );

  // Add retry metadata to each entry
  for (const entry of entriesToRetry) {
    // Initialize the syncMetadata if it doesn't exist
    if (entry.syncMetadata) {
      // Update existing syncMetadata
      entry.syncMetadata = {
        ...entry.syncMetadata,
        isRetry: true,
        retryTimestamp: Date.now(),
        retryCount: (entry.syncMetadata.retryCount || 0) + 1,
      };
    } else {
      entry.syncMetadata = {
        useIncrementalSync: false,
        targetProgress: entry.progress,
        progress: entry.progress,
        isRetry: true,
        retryTimestamp: Date.now(),
        retryCount: 1,
      };
    }
  }

  // Run the sync with only the failed entries
  return syncMangaBatch(entriesToRetry, token, onProgress, abortSignal);
}
