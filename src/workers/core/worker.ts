/**
 * Central worker entrypoint that routes all supported operations and errors through a unified handler.
 * @source
 */

import type {
  WorkerInboundMessage,
  StatisticsAggregationMessage,
  ReadingHistoryFilterMessage,
  JSONSerializeMessage,
  JSONDeserializeMessage,
  DuplicateDetectionMessage,
  DataTablePreparationMessage,
  FuzzySearchMessage,
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
import { handleFuzzySearch } from "./worker/operations/fuzzySearchOperations";

const activeTasks = new Set<string>();

/**
 * Dispatches inbound worker messages to operation-specific handlers with shared error handling.
 * @source
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

      case "FUZZY_SEARCH":
        await handleFuzzySearch(message as unknown as FuzzySearchMessage);
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
