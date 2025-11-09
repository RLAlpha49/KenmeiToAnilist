/**
 * JSON Serialization Worker Pool Wrapper
 *
 * Provides API for offloading heavy JSON.parse/stringify operations to workers.
 * This optimizes import/export functionality by freeing the main thread.
 *
 * @module workers/json-serialization-worker-pool
 */

import type { JSONSerializeMessage, JSONDeserializeMessage } from "./types";
import { getGenericWorkerPool } from "./worker-pool";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(
    /[xy]/g,
    function (c) {
      const r = Math.trunc(Math.random() * 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

export interface JSONSerializationWorkerPoolConfig {
  maxWorkers?: number;
  enableWorkers?: boolean;
  fallbackToMainThread?: boolean;
}

interface SerializationResult {
  json: string;
  sizeBytes: number;
  timingMs: number;
}

interface DeserializationResult {
  data: unknown;
  timingMs: number;
}

/**
 * Wrapper around unified pool for JSON serialization/deserialization operations
 */
export class JSONSerializationWorkerPool {
  private initialized = false;

  /**
   * Initialize the pool (delegates to unified pool)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const pool = getGenericWorkerPool();
    await pool.initialize();
    this.initialized = true;
  }

  /**
   * Check if pool is available
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Get the number of currently available workers
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Start serializing data to JSON with taskId exposed for cancellation
   */
  startSerializing(
    data: unknown,
    options: { space?: number; replacerKeys?: string[] } = {},
  ): { taskId: string; promise: Promise<SerializationResult> } {
    const taskId = generateUUID();
    const promise = this.dispatchSerialization(taskId, data, options);
    return { taskId, promise };
  }

  /**
   * Serialize data to JSON string using the unified worker pool
   */
  async serialize(
    data: unknown,
    options: { space?: number; replacerKeys?: string[] } = {},
  ): Promise<SerializationResult> {
    const { promise } = this.startSerializing(data, options);
    return promise;
  }

  /**
   * Dispatch serialization to the unified pool
   */
  private dispatchSerialization(
    taskId: string,
    data: unknown,
    options: { space?: number; replacerKeys?: string[] } = {},
  ): Promise<SerializationResult> {
    return new Promise<SerializationResult>((resolve, reject) => {
      const pool = getGenericWorkerPool();

      // Ensure pool is initialized before checking availability
      if (!pool.isAvailable()) {
        pool
          .initialize()
          .then(() => {
            this.dispatchToWorker(
              pool,
              taskId,
              "serialize",
              data,
              options,
              resolve,
              reject,
            );
          })
          .catch(() => {
            // Fallback to main thread if pool init fails
            this.serializeMainThread(data, options).then(resolve).catch(reject);
          });
        return;
      }

      this.dispatchToWorker(
        pool,
        taskId,
        "serialize",
        data,
        options,
        resolve,
        reject,
      );
    });
  }

  /**
   * Start deserializing JSON string with taskId exposed for cancellation
   */
  startDeserializing(
    json: string,
    options: { reviverKeys?: string[] } = {},
  ): { taskId: string; promise: Promise<DeserializationResult> } {
    const taskId = generateUUID();
    const promise = this.dispatchDeserialization(taskId, json, options);
    return { taskId, promise };
  }

  /**
   * Deserialize JSON string using the unified worker pool
   */
  async deserialize(
    json: string,
    options: { reviverKeys?: string[] } = {},
  ): Promise<DeserializationResult> {
    const { promise } = this.startDeserializing(json, options);
    return promise;
  }

  /**
   * Dispatch deserialization to the unified pool
   */
  private dispatchDeserialization(
    taskId: string,
    json: string,
    options: { reviverKeys?: string[] } = {},
  ): Promise<DeserializationResult> {
    return new Promise<DeserializationResult>((resolve, reject) => {
      const pool = getGenericWorkerPool();

      // Ensure pool is initialized before checking availability
      if (!pool.isAvailable()) {
        pool
          .initialize()
          .then(() => {
            this.dispatchToWorker(
              pool,
              taskId,
              "deserialize",
              json,
              options,
              resolve,
              reject,
            );
          })
          .catch(() => {
            // Fallback to main thread if pool init fails
            this.deserializeMainThread(json, options)
              .then(resolve)
              .catch(reject);
          });
        return;
      }

      this.dispatchToWorker(
        pool,
        taskId,
        "deserialize",
        json,
        options,
        resolve,
        reject,
      );
    });
  }

  /**
   * Internal helper to dispatch to worker after pool is ready
   */
  private dispatchToWorker(
    pool: ReturnType<typeof getGenericWorkerPool>,
    taskId: string,
    operation: "serialize" | "deserialize",
    payload: unknown,
    options: {
      space?: number;
      replacerKeys?: string[];
      reviverKeys?: string[];
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (result: any) => void,
    reject: (error: Error) => void,
  ): void {
    const workerIndex = pool.selectWorker();
    if (workerIndex === -1) {
      // Fallback to main thread
      if (operation === "serialize") {
        this.serializeMainThread(
          payload,
          options as { space?: number; replacerKeys?: string[] },
        )
          .then(resolve)
          .catch(reject);
      } else {
        this.deserializeMainThread(
          payload as string,
          options as { reviverKeys?: string[] },
        )
          .then(resolve)
          .catch(reject);
      }
      return;
    }

    const worker = pool.getWorker(workerIndex);
    if (!worker) {
      // Fallback to main thread
      if (operation === "serialize") {
        this.serializeMainThread(
          payload,
          options as { space?: number; replacerKeys?: string[] },
        )
          .then(resolve)
          .catch(reject);
      } else {
        this.deserializeMainThread(
          payload as string,
          options as { reviverKeys?: string[] },
        )
          .then(resolve)
          .catch(reject);
      }
      return;
    }

    // Wrap resolve to adapt raw payload to expected result shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrappedResolve = (result: any) => {
      if (operation === "serialize") {
        resolve({
          json: result.json,
          sizeBytes: result.sizeBytes,
          timingMs: result.timing?.serializationTimeMs ?? 0,
        });
      } else {
        resolve({
          data: result.data,
          timingMs: result.timing?.deserializationTimeMs ?? 0,
        });
      }
    };

    // Register task
    const task = {
      taskId,
      type: operation === "serialize" ? "serialize" : ("deserialize" as const),
      resolve: wrappedResolve,
      reject,
      cancelled: false,
      workerIndex,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pool.registerTask(taskId, task as any);

    // Send message
    if (operation === "serialize") {
      const message: JSONSerializeMessage = {
        type: "JSON_SERIALIZE",
        payload: {
          taskId,
          data: payload,
          replacerKeys: options.replacerKeys,
          space: options.space,
        },
      };
      worker.postMessage(message);
      console.info(
        `[JSONSerializationWorkerPool] 📤 Sent serialization task ${taskId} to worker ${workerIndex}`,
      );
    } else {
      const message: JSONDeserializeMessage = {
        type: "JSON_DESERIALIZE",
        payload: {
          taskId,
          json: payload as string,
          reviverKeys: options.reviverKeys,
        },
      };
      worker.postMessage(message);
      console.info(
        `[JSONSerializationWorkerPool] 📤 Sent deserialization task ${taskId} to worker ${workerIndex}`,
      );
    }
  }

  /**
   * Serialize on main thread (fallback)
   */
  private async serializeMainThread(
    data: unknown,
    options: { space?: number; replacerKeys?: string[] } = {},
  ): Promise<SerializationResult> {
    try {
      const startTime = performance.now();

      // Use replacer if keys are provided
      const replacer = options.replacerKeys
        ? (key: string, value: unknown) => {
            if (key === "" || options.replacerKeys!.includes(key)) {
              return value;
            }
            return undefined;
          }
        : undefined;

      const json = JSON.stringify(data, replacer, options.space);
      const timingMs = performance.now() - startTime;

      return {
        json,
        sizeBytes: new Blob([json]).size,
        timingMs,
      };
    } catch (error) {
      throw new Error(
        `Main thread JSON serialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Deserialize on main thread (fallback)
   */
  private async deserializeMainThread(
    json: string,
    options: { reviverKeys?: string[] } = {},
  ): Promise<DeserializationResult> {
    try {
      const startTime = performance.now();

      // Use reviver if keys are provided
      const reviver = options.reviverKeys
        ? (key: string, value: unknown) => {
            if (key === "" || options.reviverKeys!.includes(key)) {
              return value;
            }
            return undefined;
          }
        : undefined;

      const data = JSON.parse(json, reviver);
      const timingMs = performance.now() - startTime;

      return {
        data,
        timingMs,
      };
    } catch (error) {
      throw new Error(
        `Main thread JSON deserialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    activeTasks: number;
  } {
    const pool = getGenericWorkerPool();
    return pool.getStats();
  }

  /**
   * Terminate the pool
   */
  terminate(): void {
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}

/**
 * Global JSON serialization worker pool instance
 */
let jsonSerializationWorkerPoolInstance: JSONSerializationWorkerPool | null =
  null;
let initializePromise: Promise<void> | null = null;

/**
 * Get or create JSON serialization worker pool
 */
export function getJSONSerializationWorkerPool(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config?: JSONSerializationWorkerPoolConfig,
): JSONSerializationWorkerPool {
  jsonSerializationWorkerPoolInstance ??= new JSONSerializationWorkerPool();

  // Trigger initialization if not already initialized
  if (
    !jsonSerializationWorkerPoolInstance.isAvailable() &&
    !initializePromise
  ) {
    initializePromise = jsonSerializationWorkerPoolInstance
      .initialize()
      .catch(console.error)
      .finally(() => {
        initializePromise = null;
      });
  }

  return jsonSerializationWorkerPoolInstance;
}
