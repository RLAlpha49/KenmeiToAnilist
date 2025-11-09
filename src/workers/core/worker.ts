/**
 * Unified Web Worker
 *
 * A single, centralized worker implementation that handles all types of worker operations:
 * - Manga matching operations (MATCH_BATCH)
 * - CSV parsing operations (CSV_START, CSV_CHUNK, CSV_COMPLETE)
 * - Advanced filter operations (ADVANCED_FILTER)
 * - Title normalization operations (TITLE_NORMALIZATION)
 * - Task cancellation (CANCEL)
 *
 * This eliminates code duplication by consolidating task tracking, error handling,
 * cancellation logic, and message dispatching into a single worker implementation.
 *
 * Message handlers are type-specific but follow a consistent pattern,
 * allowing easy addition of new message types without duplicating infrastructure code.
 *
 * @module workers/worker
 */

import type {
  WorkerInboundMessage,
  StatisticsAggregationMessage,
  ReadingHistoryFilterMessage,
  JSONSerializeMessage,
  JSONDeserializeMessage,
  DuplicateDetectionMessage,
  DataTablePreparationMessage,
} from "./types";
import { getErrorDetails } from "./worker/errorUtils";
import {
  handleCSVStart,
  handleCSVChunk,
} from "./worker/operations/csvOperations";
import { handleMatchBatch } from "./worker/operations/matchingOperations";
import { handleAdvancedFilter } from "./worker/operations/advancedFilterOperations";
import { handleTitleNormalization } from "./worker/operations/titleNormalizationOperations";
import { handleCancel } from "./worker/cancellationHandler";
import { handleReadingHistoryFilter } from "./worker/operations/readingHistoryOperations";
import { handleStatisticsAggregation } from "./worker/operations/statisticsOperations";
import {
  handleJsonSerialize,
  handleJsonDeserialize,
} from "./worker/operations/jsonOperations";
import { handleDuplicateDetection } from "./worker/operations/duplicateDetectionOperations";
import { handleDataTablePreparation } from "./worker/operations/dataTableOperations";
import { handleBatchSync } from "./worker/operations/batchSyncOperations";

const activeTasks = new Set<string>();

/**
 * Central message handler that dispatches to specific handlers based on message type.
 * Provides unified error handling for all operation types.
 */
globalThis.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "MATCH_BATCH":
        await handleMatchBatch(message, activeTasks);
        break;

      case "BATCH_SYNC":
        await handleBatchSync(message, activeTasks);
        break;

      case "CSV_START":
        handleCSVStart(message, activeTasks);
        break;

      case "CSV_CHUNK":
        handleCSVChunk(message, activeTasks);
        break;

      case "ADVANCED_FILTER":
        handleAdvancedFilter(message);
        break;

      case "TITLE_NORMALIZATION":
        handleTitleNormalization(message, activeTasks);
        break;

      case "STATISTICS_AGGREGATION":
        await handleStatisticsAggregation(
          message as unknown as StatisticsAggregationMessage,
          activeTasks,
        );
        break;

      case "READING_HISTORY_FILTER":
        handleReadingHistoryFilter(
          message as unknown as ReadingHistoryFilterMessage,
          activeTasks,
        );
        break;

      case "JSON_SERIALIZE":
        handleJsonSerialize(
          message as unknown as JSONSerializeMessage,
          activeTasks,
        );
        break;

      case "JSON_DESERIALIZE":
        handleJsonDeserialize(
          message as unknown as JSONDeserializeMessage,
          activeTasks,
        );
        break;

      case "DUPLICATE_DETECTION":
        handleDuplicateDetection(
          message as unknown as DuplicateDetectionMessage,
          activeTasks,
        );
        break;

      case "DATA_TABLE_PREPARATION":
        handleDataTablePreparation(
          message as unknown as DataTablePreparationMessage,
          activeTasks,
        );
        break;

      case "CANCEL":
        handleCancel(message, activeTasks);
        break;

      default: {
        console.warn(
          `[Worker] Unknown message type: ${(message as unknown as Record<string, unknown>).type}`,
        );
        // Send error response for unknown message types
        const msg = message as unknown as Record<string, unknown>;
        if (
          "payload" in msg &&
          typeof msg.payload === "object" &&
          msg.payload !== null &&
          "taskId" in msg.payload
        ) {
          const payload = msg.payload as Record<string, unknown>;
          globalThis.postMessage({
            type: "ERROR",
            payload: {
              taskId: payload.taskId,
              error: {
                message: `Unknown message type: ${msg.type}`,
              },
            },
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error("[Worker] Unhandled error in worker:", error);
    const msg = message as unknown as Record<string, unknown>;
    if (
      "payload" in msg &&
      typeof msg.payload === "object" &&
      msg.payload !== null &&
      "taskId" in msg.payload
    ) {
      const payload = msg.payload as Record<string, unknown>;
      globalThis.postMessage({
        type: "ERROR",
        payload: {
          taskId: payload.taskId,
          error: getErrorDetails(error),
        },
      });
    }
  }
};
