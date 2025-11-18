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
import {
  determineIncrementalSteps,
  buildVariablesForStep,
} from "./incremental-sync";
import { AniListMediaEntry } from "./types";
import { RATE_LIMIT_CONFIG } from "../../config/anilist";
import { storage, STORAGE_KEYS } from "../../utils/storage";
import { withGroupAsync } from "../../utils/logging";
import { BatchSyncWorkerPool } from "@/workers";

/**
 * Type alias for GraphQL mutation variables mapping.
 * @source
 */
type GraphQLVariables = Record<string, string | number | boolean>;

/**
 * Builds GraphQL variables for updating an existing entry, including only changed fields.
 * @param mediaEntry - The entry with previousValues indicating what changed.
 * @returns GraphQL variables object with mediaId and changed fields.
 * @source
 */
function buildVariablesForExistingEntry(
  mediaEntry: AniListMediaEntry,
): GraphQLVariables {
  const variables: GraphQLVariables = {
    mediaId: mediaEntry.mediaId,
  };

  if (!mediaEntry.previousValues) {
    // previousValues missing: fall back to new entry behavior
    console.warn(
      `[AniListSync] ⚠️ buildVariablesForExistingEntry: previousValues missing for media ${mediaEntry.mediaId}, falling back to new-entry variable build`,
    );
    return buildVariablesForNewEntry(mediaEntry);
  }

  // Only include fields that have changed
  if (mediaEntry.status !== mediaEntry.previousValues.status)
    variables.status = mediaEntry.status;

  if (mediaEntry.progress !== mediaEntry.previousValues.progress)
    variables.progress = mediaEntry.progress;

  if (mediaEntry.score !== mediaEntry.previousValues.score)
    variables.score =
      typeof mediaEntry.score === "number" ? mediaEntry.score : 0;

  // Only include private flag if it's explicitly set or has changed
  if (
    typeof mediaEntry.private === "boolean" &&
    mediaEntry.previousValues.private !== mediaEntry.private
  ) {
    variables.private = mediaEntry.private;
  }

  return variables;
}

/**
 * Builds GraphQL variables for creating a new entry with all specified fields.
 * @param mediaEntry - The new entry with complete data.
 * @returns GraphQL variables object with mediaId, status, and optional fields.
 * @source
 */
function buildVariablesForNewEntry(
  mediaEntry: AniListMediaEntry,
): GraphQLVariables {
  const variables: GraphQLVariables = {
    mediaId: mediaEntry.mediaId,
    status: mediaEntry.status,
  };

  if (typeof mediaEntry.progress === "number" && mediaEntry.progress >= 0)
    variables.progress = mediaEntry.progress;

  if (typeof mediaEntry.score === "number" && mediaEntry.score >= 0)
    variables.score = mediaEntry.score;

  if (mediaEntry.private !== undefined) variables.private = mediaEntry.private;

  return variables;
}

/**
 * Handles incremental sync step 1: increments progress by 1 from current value.
 * @param mediaEntry - The entry being synced.
 * @param operationId - Unique operation identifier for logging.
 * @returns GraphQL variables with incremented progress.
 * @source
 */
function handleIncrementalStep1(
  mediaEntry: AniListMediaEntry,
  operationId: string,
): GraphQLVariables {
  const variables = buildVariablesForStep(mediaEntry, 1);
  console.debug(
    `[AniListSync] 📊 [${operationId}] Incremental sync step 1: variables=${JSON.stringify(
      variables,
    )}`,
  );
  return variables as GraphQLVariables;
}

/**
 * Handles incremental sync step 2: sets progress to final target value.
 * @param mediaEntry - The entry being synced.
 * @param operationId - Unique operation identifier for logging.
 * @returns GraphQL variables with target progress value.
 * @source
 */
function handleIncrementalStep2(
  mediaEntry: AniListMediaEntry,
  operationId: string,
): GraphQLVariables {
  const variables = buildVariablesForStep(mediaEntry, 2);
  console.debug(
    `[AniListSync] 📊 [${operationId}] Incremental sync step 2: variables=${JSON.stringify(
      variables,
    )}`,
  );
  return variables as GraphQLVariables;
}

/**
 * Handles incremental sync step 3: updates status, score, and private flag.
 * @param mediaEntry - The entry being synced.
 * @param operationId - Unique operation identifier for logging.
 * @returns GraphQL variables with metadata changes.
 * @source
 */
function handleIncrementalStep3(
  mediaEntry: AniListMediaEntry,
  operationId: string,
): GraphQLVariables {
  const variables = buildVariablesForStep(mediaEntry, 3);
  const changes: string[] = [];
  if (variables.status) changes.push(`status to ${variables.status}`);
  if (variables.score !== undefined)
    changes.push(`score to ${variables.score}`);
  if (variables.private !== undefined)
    changes.push(`private to ${variables.private}`);

  const updateInfo =
    changes.length > 0 ? changes.join(", ") : "no additional fields";
  console.debug(
    `[AniListSync] 📊 [${operationId}] Incremental sync step 3: Updating ${updateInfo}`,
  );

  return variables as GraphQLVariables;
}

/**
 * Applies incremental sync step modifications to GraphQL variables.
 * Modifies variables based on the current step number in syncMetadata.
 * @param mediaEntry - The entry with syncMetadata.step indicating which step to apply.
 * @param variables - Base GraphQL variables to potentially modify.
 * @param operationId - Unique operation identifier for logging.
 * @returns Modified GraphQL variables appropriate for the current step.
 * @source
 */
function applyIncrementalSyncStep(
  mediaEntry: AniListMediaEntry,
  variables: GraphQLVariables,
  operationId: string,
): GraphQLVariables {
  const step = mediaEntry.syncMetadata?.step;
  if (!step) return variables;

  switch (step) {
    case 1:
      return handleIncrementalStep1(mediaEntry, operationId);
    case 2:
      return handleIncrementalStep2(mediaEntry, operationId);
    case 3:
      return handleIncrementalStep3(mediaEntry, operationId);
    default:
      return variables;
  }
}

/**
 * Extracts the retry-after delay in milliseconds from GraphQL error extensions or error message.
 * @param errors - Array of GraphQL error objects with optional extensions and message.
 * @returns Retry delay in milliseconds (default 60000).
 * @source
 */
function extractRetryAfterTime(
  errors: { extensions?: { retryAfter?: number }; message: string }[],
): number {
  const defaultRetryAfterMs =
    RATE_LIMIT_CONFIG?.retryDelay ??
    Math.ceil(60000 / RATE_LIMIT_CONFIG.maxRequestsPerMinute);

  for (const err of errors) {
    if (err.extensions?.retryAfter)
      return Number(err.extensions.retryAfter) * 1000;

    const timeMatch = new RegExp(/(\d+)\s*(?:second|sec|s)/i).exec(err.message);
    if (timeMatch?.[1]) return Number(timeMatch[1]) * 1000;
  }

  return defaultRetryAfterMs;
}

/**
 * Checks if GraphQL errors indicate rate limiting based on error message patterns.
 * @param errors - Array of GraphQL error objects.
 * @returns true if any error indicates rate limiting.
 * @source
 */
function isRateLimitError(errors: { message: string }[]): boolean {
  return errors.some(
    (err) =>
      err.message.toLowerCase().includes("rate limit") ||
      err.message.toLowerCase().includes("too many requests"),
  );
}

/**
 * Processes GraphQL errors and constructs appropriate SyncResult with rate limit detection.
 * @param errors - Array of GraphQL error objects.
 * @param mediaId - The media ID that failed.
 * @param operationId - Unique operation identifier for logging.
 * @returns SyncResult indicating failure with error details and rate limit info.
 * @source
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
 * Extracts SaveMediaListEntry response data and constructs appropriate SyncResult.
 * Handles multiple response nesting levels from different API response formats.
 * @param response - API response object potentially containing SaveMediaListEntry.
 * @param mediaId - The media ID that was updated.
 * @param operationId - Unique operation identifier for logging.
 * @returns SyncResult indicating success or failure.
 * @source
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
 * Detects if error is a 500 Internal Server Error from various error formats.
 * @param error - The error object to check.
 * @param errorMessage - String representation of the error.
 * @returns true if error is identified as a 500 server error.
 * @source
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
 * Infers recovery metadata for error reporting based on error message patterns.
 * Maps common error keywords to suggested recovery actions and user-friendly messages.
 * @param errorMessage - Error message to analyze.
 * @returns Recovery metadata with suggested action, message, and action type.
 * @source
 */
function inferRecoveryMetadata(errorMessage: string): {
  recoveryAction: string;
  recoveryMessage: string;
  recoveryActionType: "retry" | "refresh-token" | "check-connection" | "wait";
} {
  const errorLower = errorMessage.toLowerCase();

  if (
    errorLower.includes("network") ||
    errorLower.includes("fetch") ||
    errorLower.includes("connection")
  ) {
    return {
      recoveryAction: "Check Connection",
      recoveryMessage: "Verify your internet connection and try again.",
      recoveryActionType: "check-connection",
    };
  }

  if (
    errorLower.includes("unauthorized") ||
    errorLower.includes("token") ||
    errorLower.includes("auth")
  ) {
    return {
      recoveryAction: "Refresh Token",
      recoveryMessage: "Your session has expired. Please reauthenticate.",
      recoveryActionType: "refresh-token",
    };
  }

  if (errorLower.includes("rate") || errorLower.includes("429")) {
    return {
      recoveryAction: "Wait & Retry",
      recoveryMessage: "Rate limit reached. Wait a moment before retrying.",
      recoveryActionType: "wait",
    };
  }

  if (errorLower.includes("timeout") || errorLower.includes("408")) {
    return {
      recoveryAction: "Retry Later",
      recoveryMessage: "The request timed out. Try again in a moment.",
      recoveryActionType: "wait",
    };
  }

  return {
    recoveryAction: "Retry",
    recoveryMessage: "An unexpected error occurred. Please try again.",
    recoveryActionType: "retry",
  };
}

/**
 * Logs detailed error information including type, message, and stack trace.
 * Used for debugging failed update operations.
 * @param error - The error object to log.
 * @param mediaEntry - The entry that failed.
 * @param operationId - Unique operation identifier for tracking.
 * @source
 */
function logErrorDetails(
  error: unknown,
  mediaEntry: AniListMediaEntry,
  operationId: string,
): void {
  console.error(
    `[AniListSync] ❌ [${operationId}] Error updating entry ${mediaEntry.mediaId}:`,
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
    mediaId: mediaEntry.mediaId,
    title: mediaEntry.title,
    status: mediaEntry.status,
    progress: mediaEntry.progress,
    score: mediaEntry.score,
  });
}

/**
 * Processes exception errors during entry update and returns appropriate SyncResult.
 * Detects 500 server errors for automatic retry handling.
 * @param error - The caught exception.
 * @param mediaEntry - The entry that failed to update.
 * @param operationId - Unique operation identifier for logging.
 * @returns SyncResult with error details and retry guidance.
 * @source
 */
function handleUpdateError(
  error: unknown,
  mediaEntry: AniListMediaEntry,
  operationId: string,
): SyncResult {
  const errorMessage =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  logErrorDetails(error, mediaEntry, operationId);

  if (is500ServerError(error, errorMessage)) {
    console.warn(
      `⚠️ [${operationId}] 500 Server Error detected. Will perform automatic retry.`,
    );

    const retryDelay = 3000;
    return {
      success: false,
      mediaId: mediaEntry.mediaId,
      error: `Server Error (500): ${errorMessage}. Automatic retry scheduled.`,
      rateLimited: true,
      retryAfter: retryDelay,
    };
  }

  return {
    success: false,
    mediaId: mediaEntry.mediaId,
    error: errorMessage,
    rateLimited: false,
    retryAfter: null,
  };
}

/**
 * Rate limiting constant: maximum requests allowed per minute (28 out of AniList's 60).
 * @source
 */
const MAX_REQUESTS_PER_MINUTE = RATE_LIMIT_CONFIG.maxRequestsPerMinute;
/**
 * Request interval in milliseconds calculated from rate limit constant.
 * Enforces minimum time between API requests.
 * @source
 */
const REQUEST_INTERVAL = Math.ceil(60000 / MAX_REQUESTS_PER_MINUTE); // Time between requests

/**
 * Singleton instance of the batch sync worker pool.
 * Manages pre-processing of batch sync entries using web workers.
 * @source
 */
let batchSyncWorkerPool: BatchSyncWorkerPool | null = null;

/**
 * Get or create the batch sync worker pool singleton.
 * @returns The batch sync worker pool instance
 * @source
 */
function getBatchSyncWorkerPool(): BatchSyncWorkerPool {
  batchSyncWorkerPool ??= new BatchSyncWorkerPool({
    maxWorkers: 4,
    enableWorkers: true,
    fallbackToMainThread: true,
  });
  return batchSyncWorkerPool;
}

/**
 * Result of a single manga sync/update operation with rate limit information.
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
 * Progress tracking information for an ongoing batch sync operation.
 * Updated periodically for UI progress display and rate limit countdowns.
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
 * Final report summarizing a completed sync batch operation.
 * Includes success/failure counts, errors, and timestamp for statistics tracking.
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
    recoveryAction?: string; // Suggested action to recover (e.g., "Refresh Token", "Retry")
    recoveryMessage?: string; // User-friendly message explaining the action
    recoveryActionType?:
      | "retry"
      | "refresh-token"
      | "check-connection"
      | "wait";
  }[];
  /** ISO 8601 timestamp string of when the sync was performed */
  timestamp: string;
}

/**
 * Update a single manga entry in AniList.
 *
 * @param mediaEntry - The AniList media entry to update.
 * @param token - The user's authentication token.
 * @returns A promise resolving to a SyncResult object.
 * @source
 */
export async function updateMangaEntry(
  mediaEntry: AniListMediaEntry,
  token: string,
): Promise<SyncResult> {
  // Generate an operation ID for tracking in logs early
  const operationId = `${mediaEntry.mediaId}-${Date.now().toString(36).substring(4, 10)}`;

  return withGroupAsync(
    `[AniListSync] Update Entry [${operationId}] - Media ${mediaEntry.mediaId}`,
    async () => {
      if (!token) {
        console.error(
          `[AniListSync] ❌ [${operationId}] No authentication token provided`,
        );
        return {
          success: false,
          mediaId: mediaEntry.mediaId,
          error: "No authentication token provided",
          rateLimited: false,
          retryAfter: null,
        };
      }

      try {
        // Build variables based on entry type (existing vs new)
        let variables = mediaEntry.previousValues
          ? buildVariablesForExistingEntry(mediaEntry)
          : buildVariablesForNewEntry(mediaEntry);

        // Apply incremental sync modifications if needed
        variables = applyIncrementalSyncStep(
          mediaEntry,
          variables,
          operationId,
        );

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
          return handleGraphQLErrors(
            response.errors,
            mediaEntry.mediaId,
            operationId,
          );
        }

        // Handle response data
        return handleResponseData(response, mediaEntry.mediaId, operationId);
      } catch (error) {
        // Handle exception errors
        return handleUpdateError(error, mediaEntry, operationId);
      }
    },
  );
}

/**
 * Deletes a manga entry from the user's AniList collection by entry ID.
 * @param entryId - The AniList entry ID to delete.
 * @param token - User's access token.
 * @returns Promise resolving to result with success flag and optional error message.
 * @source
 */
export async function deleteMangaEntry(
  entryId: number,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  // Generate an operation ID for tracking in logs
  const operationId = `del-${entryId}-${Date.now().toString(36).substring(4, 10)}`;

  return withGroupAsync(
    `[AniListSync] Delete Entry [${operationId}]`,
    async () => {
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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
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
    },
  );
}

/**
 * Determines the complete set of incremental steps for an entry, considering resume points.
 * @param mediaEntry - The entry with syncMetadata and optional resumeFromStep.
 * @returns Array of step numbers to execute, filtered by resumeFromStep if present.
 * @source
 */
function getIncrementalSteps(mediaEntry: AniListMediaEntry): number[] {
  const steps = determineIncrementalSteps(mediaEntry);
  const resumeFromStep = mediaEntry.syncMetadata?.resumeFromStep;
  return resumeFromStep
    ? steps.filter((step) => step >= resumeFromStep)
    : steps;
}

/**
 * Handles rate limiting with countdown timer and progress callbacks.
 * Updates progress every second during the retry delay.
 * @param progress - Sync progress object to update with countdown.
 * @param result - SyncResult with retryAfter milliseconds.
 * @param onProgress - Optional callback for progress updates (called with countdown).
 * @param abortSignal - Optional signal to abort the retry wait.
 * @returns Promise that resolves after retry delay completes.
 * @source
 */
async function handleRateLimitRetry(
  progress: SyncProgress,
  result: SyncResult,
  onProgress?: (progress: SyncProgress) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  const retryAfterMs = result.retryAfter!;

  return withGroupAsync(
    `[AniListSync] Rate Limit Wait (${Math.round(retryAfterMs / 1000)}s)`,
    async () => {
      progress.rateLimited = true;
      progress.retryAfter = retryAfterMs;

      if (onProgress) {
        console.warn(
          `[AniListSync] ⏳ Rate limited: retryAfter=${retryAfterMs}ms`,
        );
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
    },
  );
}

/**
 * Organizes entries by media ID, expanding incremental steps into separate entry objects.
 * Each step becomes a separate entry for proper sequencing.
 * @param entries - Array of entries to organize.
 * @returns Object mapping mediaId to array of (potentially expanded) entries.
 * @source
 */
function organizeEntriesByMediaId(
  entries: AniListMediaEntry[],
): Record<number, AniListMediaEntry[]> {
  const entriesGroupedByMediaId: Record<number, AniListMediaEntry[]> = {};

  for (const mediaEntry of entries) {
    if (!entriesGroupedByMediaId[mediaEntry.mediaId])
      entriesGroupedByMediaId[mediaEntry.mediaId] = [];

    if (mediaEntry.syncMetadata?.useIncrementalSync) {
      const steps = getIncrementalSteps(mediaEntry);
      for (const step of steps) {
        const stepEntry = { ...mediaEntry };
        stepEntry.syncMetadata = {
          ...mediaEntry.syncMetadata,
          step: step,
        };
        entriesGroupedByMediaId[mediaEntry.mediaId].push(stepEntry);
      }
    } else {
      entriesGroupedByMediaId[mediaEntry.mediaId].push(mediaEntry);
    }
  }

  return entriesGroupedByMediaId;
}

/**
 * Determines the order of media IDs to process, respecting user-specified order if provided.
 * @param displayOrderMediaIds - Optional user-specified processing order.
 * @param entriesGroupedByMediaId - Organized entries by media ID.
 * @returns Array of media IDs in processing order.
 * @source
 */
function determineProcessingOrder(
  displayOrderMediaIds: number[] | undefined,
  entriesGroupedByMediaId: Record<number, AniListMediaEntry[]>,
): number[] {
  return displayOrderMediaIds && displayOrderMediaIds.length > 0
    ? displayOrderMediaIds
    : Object.keys(entriesGroupedByMediaId).map(Number);
}

/**
 * Initializes progress tracking for a specific media entry or batch.
 * Sets up currentEntry info and step tracking if incremental sync.
 * @param mediaId - Current media ID being processed.
 * @param entriesForMediaId - Entries for this media ID.
 * @param progress - Sync progress object to update.
 * @returns Object indicating if incremental sync is active.
 * @source
 */
function setupProgressForMedia(
  mediaId: number,
  entriesForMediaId: AniListMediaEntry[],
  progress: SyncProgress,
): { isIncremental: boolean } {
  const mediaIdStr = String(mediaId);
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
 * Context object for processing entry steps with shared state.
 * @source
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
 * Processes a single entry step with rate limiting, error handling, and progress tracking.
 * Handles retries automatically if rate-limited and logs detailed errors.
 * @param mediaEntry - Current entry to process.
 * @param entryIndex - Index in the entries array.
 * @param isIncremental - Whether this is incremental sync (affects error handling).
 * @param context - Processing context with shared state and callbacks.
 * @returns Promise resolving to result with success flag and retry guidance.
 * @source
 */
async function processEntryStep(
  mediaEntry: AniListMediaEntry,
  entryIndex: number,
  isIncremental: boolean,
  context: EntryProcessingContext,
): Promise<{ success: boolean; error?: string; shouldRetry: boolean }> {
  // Update progress step
  if (isIncremental)
    context.progress.currentStep =
      mediaEntry.syncMetadata?.step || entryIndex + 1;

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

    const result = await updateMangaEntry(mediaEntry, context.token);
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
    const errorOpId = `err-${context.mediaIdStr}-${mediaEntry.syncMetadata?.step || 0}-${Date.now().toString(36).substring(4, 10)}`;

    console.error(
      `[AniListSync] ❌ [${errorOpId}] Error updating entry ${context.mediaIdStr}:`,
      error,
    );
    console.error(`[AniListSync]    [${errorOpId}] Entry details:`, {
      mediaId: mediaEntry.mediaId,
      title: mediaEntry.title,
      status: mediaEntry.status,
      progress: mediaEntry.progress,
      score: mediaEntry.score,
      incremental: isIncremental,
      step: mediaEntry.syncMetadata?.step || "N/A",
    });

    return {
      success: false,
      error: entryError,
      shouldRetry: false,
    };
  }
}

/**
 * Processes all entries for a single media ID, handling incremental sync and retries.
 * @param mediaId - Media ID to process.
 * @param entriesGroupedByMediaId - All organized entries by media ID.
 * @param token - User's access token.
 * @param apiCallsCompleted - Reference object tracking total API calls.
 * @param progress - Current sync progress to update.
 * @param onProgress - Optional progress callback.
 * @param abortSignal - Optional signal to abort processing.
 * @returns Promise resolving to result with success flag and optional error.
 * @source
 */
async function processMediaEntries(
  mediaId: number,
  entriesGroupedByMediaId: Record<number, AniListMediaEntry[]>,
  token: string,
  apiCallsCompleted: { count: number },
  progress: SyncProgress,
  onProgress: ((progress: SyncProgress) => void) | undefined,
  abortSignal: AbortSignal | undefined,
): Promise<{ success: boolean; error?: string }> {
  return withGroupAsync(
    `[AniListSync] Process Media ${mediaId} (${progress.completed + 1}/${progress.total})`,
    async () => {
      const entriesForMediaId = entriesGroupedByMediaId[mediaId];
      const mediaIdStr = String(mediaId);

      if (!entriesForMediaId) return { success: true }; // Skip if not present

      console.debug(
        `[AniListSync] 📚 Starting sync for manga ${mediaId} (${progress.completed + 1}/${progress.total})`,
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
        mediaId,
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

        const mediaEntry = entriesForMediaId[entryIndex];
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
          mediaEntry,
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
    },
  );
}

/**
 * Generates final sync report and persists sync statistics to storage.
 * @param entries - Original entries array (for statistics).
 * @param progress - Final sync progress state.
 * @param errors - Array of errors that occurred during sync.
 * @returns Completed SyncReport object with summary and error details.
 * @source
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
    timestamp: new Date().toISOString(),
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
 * Processes a single media ID within a batch sync operation.
 * Updates progress, handles errors, and invokes batch completion callbacks.
 * @param mediaId - Media ID to process from the batch.
 * @param context - Processing context with shared state, callbacks, and configuration.
 * @returns Promise that resolves when processing completes.
 * @source
 */
async function processMediaIdInBatch(
  mediaId: number,
  context: {
    entriesGroupedByMediaId: Record<number, AniListMediaEntry[]>;
    token: string;
    apiCallsCompleted: { count: number };
    progress: SyncProgress;
    onProgress?: (progress: SyncProgress) => void;
    abortSignal?: AbortSignal;
    onBatchComplete?: (
      progress: SyncProgress,
      batchResult: { mediaId: number; success: boolean; error?: string },
    ) => void;
    errors?: { mediaId: number; error: string }[];
  },
): Promise<void> {
  const mediaEntries = context.entriesGroupedByMediaId[mediaId];

  if (!mediaEntries || mediaEntries.length === 0) {
    console.debug(
      `[AniListSync] ⏭️ Skipping media ${mediaId} — no entries in current batch`,
    );
    return;
  }

  if (context.abortSignal?.aborted) {
    console.info("[AniListSync] ⏹️ Sync operation aborted by user");
    return;
  }

  const result = await processMediaEntries(
    mediaId,
    context.entriesGroupedByMediaId,
    context.token,
    context.apiCallsCompleted,
    context.progress,
    context.onProgress,
    context.abortSignal,
  );

  // Update progress counters
  context.progress.completed++;

  if (result.success) {
    context.progress.successful++;
  } else {
    context.progress.failed++;
    if (result.error && context.errors) {
      const metadata = inferRecoveryMetadata(result.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorEntry: any = {
        mediaId: mediaId,
        error: result.error,
        recoveryAction: metadata.recoveryAction,
        recoveryMessage: metadata.recoveryMessage,
        recoveryActionType: metadata.recoveryActionType,
      };
      context.errors.push(errorEntry);
    }
  }

  // Clear current entry info
  context.progress.currentEntry = null;
  context.progress.currentStep = null;

  if (context.onProgress) context.onProgress({ ...context.progress });

  // Persist checkpoint after each batch (media ID) completes
  if (context.onBatchComplete)
    context.onBatchComplete(
      { ...context.progress },
      {
        mediaId: mediaId,
        success: result.success,
        error: result.error,
      },
    );
}

/**
 * Process a batch of manga updates with rate limiting and progress tracking.
 *
 * @param mediaEntries - Array of AniList media entries to sync.
 * @param token - The user's authentication token.
 * @param onProgress - Optional callback for progress updates.
 * @param abortSignal - Optional abort signal to cancel the sync.
 * @param displayOrderMediaIds - Optional array of media IDs to control sync order.
 * @param onBatchComplete - Optional callback fired after each media ID completes (batch boundary).
 *   Called with current progress state and last batch result to enable checkpoint persistence.
 * @returns A promise resolving to a SyncReport object.
 * @source
 */
export async function syncMangaBatch(
  mediaEntries: AniListMediaEntry[],
  token: string,
  onProgress?: (progress: SyncProgress) => void,
  abortSignal?: AbortSignal,
  displayOrderMediaIds?: number[],
  onBatchComplete?: (
    progress: SyncProgress,
    batchResult: { mediaId: number; success: boolean; error?: string },
  ) => void,
): Promise<SyncReport> {
  return withGroupAsync(
    `[AniListSync] Batch Sync (${mediaEntries.length} entries)`,
    async () => {
      const errors: { mediaId: number; error: string }[] = [];

      // Initialize progress
      const initialProgress: SyncProgress = {
        total: mediaEntries.length,
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

      if (onProgress) onProgress({ ...initialProgress });

      // Use worker pool for pre-processing
      const pool = getBatchSyncWorkerPool();
      await pool.initialize();

      try {
        await pool.executeBatchSyncPreprocessing(
          mediaEntries,
          (
            phase: string,
            processed: number,
            total: number,
            currentMediaId?: number,
          ) => {
            // Update progress during pre-processing phase
            const progress: SyncProgress = {
              ...initialProgress,
              completed: processed,
              total: total,
            };
            if (currentMediaId) {
              const mediaEntry = mediaEntries.find(
                (e) => e.mediaId === currentMediaId,
              );
              if (mediaEntry) {
                progress.currentEntry = {
                  mediaId: currentMediaId,
                  title: mediaEntry.title || "Unknown",
                  coverImage: mediaEntry.coverImage || "",
                };
              }
            }
            if (onProgress) onProgress(progress);
          },
        );
      } catch (error) {
        console.error(
          "[AniListSync] ⚠️  Pre-processing failed, continuing with direct sync:",
          error,
        );
        // Pre-processing failure is not fatal - continue with direct sync
      }

      // Organize entries by media ID for handling incremental sync properly
      const entriesGroupedByMediaId = organizeEntriesByMediaId(mediaEntries);

      // Determine processing order and unique entry count
      const userOrderMediaIds = determineProcessingOrder(
        displayOrderMediaIds,
        entriesGroupedByMediaId,
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
      for (const mediaId of userOrderMediaIds) {
        await processMediaIdInBatch(mediaId, {
          entriesGroupedByMediaId,
          token,
          apiCallsCompleted,
          progress,
          onProgress,
          abortSignal,
          onBatchComplete,
          errors,
        });

        // If the caller aborted during processing, exit early
        if (abortSignal?.aborted) break;
      }

      return generateSyncReport(mediaEntries, progress, errors);
    },
  );
}

/**
 * Retry failed updates from a previous sync.
 *
 * @param entries - Array of AniList media entries.
 * @param failedMediaIds - Array of media IDs that failed in the previous sync.
 * @param token - The user's authentication token.
 * @param onProgress - Optional callback for progress updates.
 * @param abortSignal - Optional abort signal to cancel the retry.
 * @param onBatchComplete - Optional callback fired after each media ID completes.
 * @returns A promise resolving to a SyncReport object.
 * @source
 */
export async function retryFailedUpdates(
  entries: AniListMediaEntry[],
  failedMediaIds: number[],
  token: string,
  onProgress?: (progress: SyncProgress) => void,
  abortSignal?: AbortSignal,
  onBatchComplete?: (
    progress: SyncProgress,
    batchResult: { mediaId: number; success: boolean; error?: string },
  ) => void,
): Promise<SyncReport> {
  // Filter entries to only include previously failed ones
  const entriesToRetry = entries.filter((mediaEntry) =>
    failedMediaIds.includes(mediaEntry.mediaId),
  );

  console.info(
    `[AniListSync] 🔄 Retrying ${entriesToRetry.length} failed updates out of ${entries.length} total entries`,
  );

  // Add retry metadata to each entry
  for (const mediaEntry of entriesToRetry) {
    // Initialize the syncMetadata if it doesn't exist
    if (mediaEntry.syncMetadata) {
      // Update existing syncMetadata
      mediaEntry.syncMetadata = {
        ...mediaEntry.syncMetadata,
        isRetry: true,
        retryTimestamp: Date.now(),
        retryCount: (mediaEntry.syncMetadata.retryCount || 0) + 1,
      };
    } else {
      mediaEntry.syncMetadata = {
        useIncrementalSync: false,
        targetProgress: mediaEntry.progress,
        progress: mediaEntry.progress,
        isRetry: true,
        retryTimestamp: Date.now(),
        retryCount: 1,
      };
    }
  }

  // Run the sync with only the failed entries
  return syncMangaBatch(
    entriesToRetry,
    token,
    onProgress,
    abortSignal,
    undefined,
    onBatchComplete,
  );
}
