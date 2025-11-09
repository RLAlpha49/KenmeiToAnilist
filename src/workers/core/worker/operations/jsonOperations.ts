import type { JSONSerializeMessage, JSONDeserializeMessage } from "../../types";
import { getErrorDetails } from "../errorUtils";

/**
 * Handle JSON serialization operation.
 * Offloads JSON.stringify to worker thread for heavy payloads.
 */
export function handleJsonSerialize(
  message: JSONSerializeMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, data, replacerKeys, space } = message.payload;

  activeTasks.add(taskId);

  try {
    console.info(`[Worker] 📝 Starting JSON serialization for task ${taskId}`);
    const startTime = performance.now();

    const replacer = replacerKeys
      ? (key: string, value: unknown) => {
          if (key === "" || replacerKeys.includes(key)) {
            return value;
          }
          return undefined;
        }
      : undefined;

    const json = JSON.stringify(data, replacer, space);
    const serializationTimeMs = performance.now() - startTime;
    const sizeBytes = new Blob([json]).size;

    globalThis.postMessage({
      type: "JSON_SERIALIZE_RESULT",
      payload: {
        taskId,
        json,
        sizeBytes,
        timing: {
          serializationTimeMs,
        },
      },
    });

    console.info(
      `[Worker] ✅ JSON serialization task ${taskId} completed (${serializationTimeMs.toFixed(2)}ms, ${sizeBytes} bytes)`,
    );
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in JSON serialization task ${taskId}:`,
      error,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: getErrorDetails(error),
      },
    });
  } finally {
    activeTasks.delete(taskId);
  }
}

/**
 * Handle JSON deserialization operation.
 * Offloads JSON.parse to worker thread for heavy payloads.
 */
export function handleJsonDeserialize(
  message: JSONDeserializeMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, json, reviverKeys } = message.payload;

  activeTasks.add(taskId);

  try {
    console.info(
      `[Worker] 📝 Starting JSON deserialization for task ${taskId}`,
    );
    const startTime = performance.now();

    const reviver = reviverKeys
      ? (key: string, value: unknown) => {
          if (key === "" || reviverKeys.includes(key)) {
            return value;
          }
          return undefined;
        }
      : undefined;

    const data = JSON.parse(json, reviver);
    const deserializationTimeMs = performance.now() - startTime;

    globalThis.postMessage({
      type: "JSON_DESERIALIZE_RESULT",
      payload: {
        taskId,
        data,
        timing: {
          deserializationTimeMs,
        },
      },
    });

    console.info(
      `[Worker] ✅ JSON deserialization task ${taskId} completed (${deserializationTimeMs.toFixed(2)}ms)`,
    );
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in JSON deserialization task ${taskId}:`,
      error,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: getErrorDetails(error),
      },
    });
  } finally {
    activeTasks.delete(taskId);
  }
}
