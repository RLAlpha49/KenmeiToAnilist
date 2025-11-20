/**
 * Provides worker-pool-backed JSON serialization and deserialization for heavy operations.
 * @source
 */

import type {
  JSONSerializeMessage,
  JSONDeserializeMessage,
} from "../core/types";
import { getGenericWorkerPool } from "../core/worker-pool";

/**
 * Generates a random UUID for JSON tasks.
 * @returns A UUID string.
 * @source
 */
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

/**
 * Configuration for the JSON serialization worker pool.
 * @source
 */
export interface JSONSerializationWorkerPoolConfig {
  maxWorkers?: number;
  enableWorkers?: boolean;
  fallbackToMainThread?: boolean;
}

/**
 * Result of a JSON serialization operation.
 * @source
 */
interface SerializationResult {
  json: string;
  sizeBytes: number;
  timingMs: number;
}

/**
 * Result of a JSON deserialization operation.
 * @source
 */
interface DeserializationResult {
  data: unknown;
  timingMs: number;
}

/**
 * Manages JSON serialization and deserialization tasks using the shared worker pool.
 * @source
 */
export class JSONSerializationWorkerPool {
  private initialized = false;

  /**
   * Initializes the underlying generic worker pool once.
   * @source
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
   * Indicates whether the JSON worker pool is initialized and available.
   * @returns True if the pool is initialized and usable.
   * @source
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Returns the number of currently available workers for JSON tasks.
   * @returns Count of idle workers.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Starts a JSON serialization task and exposes its id for tracking or cancellation.
   * @param data - Data to serialize.
   * @param options - Optional serialization options.
   * @returns Task id and promise resolving to serialization result.
   * @source
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
   * Serializes data to JSON using the worker pool or main-thread fallback.
   * @param data - Data to serialize.
   * @param options - Optional serialization settings.
   * @returns Serialization result.
   * @source
   */
  async serialize(
    data: unknown,
    options: { space?: number; replacerKeys?: string[] } = {},
  ): Promise<SerializationResult> {
    const { promise } = this.startSerializing(data, options);
    return promise;
  }

  /**
   * Dispatches serialization to the shared worker pool with main-thread fallback.
   * @param taskId - Unique task id.
   * @param data - Data to serialize.
   * @param options - Serialization options.
   * @returns Promise resolving to serialization result.
   * @source
   */
  private dispatchSerialization(
    taskId: string,
    data: unknown,
    options: { space?: number; replacerKeys?: string[] } = {},
  ): Promise<SerializationResult> {
    return new Promise<SerializationResult>((resolve, reject) => {
      const pool = getGenericWorkerPool();

      pool
        .ensureInitialized()
        .then(() => {
          if (!pool.isAvailable()) {
            this.serializeMainThread(data, options).then(resolve).catch(reject);
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
        })
        .catch(() => {
          this.serializeMainThread(data, options).then(resolve).catch(reject);
        });
    });
  }

  /**
   * Starts a JSON deserialization task and exposes its id for tracking or cancellation.
   * @param json - JSON string to deserialize.
   * @param options - Optional deserialization options.
   * @returns Task id and promise resolving to deserialization result.
   * @source
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
   * Deserializes JSON using the worker pool or main-thread fallback.
   * @param json - JSON string to deserialize.
   * @param options - Optional deserialization options.
   * @returns Deserialization result.
   * @source
   */
  async deserialize(
    json: string,
    options: { reviverKeys?: string[] } = {},
  ): Promise<DeserializationResult> {
    const { promise } = this.startDeserializing(json, options);
    return promise;
  }

  /**
   * Dispatches deserialization to the shared worker pool with main-thread fallback.
   * @param taskId - Unique task id.
   * @param json - JSON string payload.
   * @param options - Deserialization options.
   * @returns Promise resolving to deserialization result.
   * @source
   */
  private dispatchDeserialization(
    taskId: string,
    json: string,
    options: { reviverKeys?: string[] } = {},
  ): Promise<DeserializationResult> {
    return new Promise<DeserializationResult>((resolve, reject) => {
      const pool = getGenericWorkerPool();

      // Ensure pool is initialized before checking availability
      pool
        .ensureInitialized()
        .then(() => {
          if (!pool.isAvailable()) {
            this.deserializeMainThread(json, options)
              .then(resolve)
              .catch(reject);
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
        })
        .catch(() => {
          this.deserializeMainThread(json, options).then(resolve).catch(reject);
        });
    });
  }

  /**
   * Sends a JSON task to a selected worker and adapts its response into typed results.
   * Falls back to main-thread execution when no worker is available.
   * @param pool - Shared worker pool instance.
   * @param taskId - Unique task id.
   * @param operation - Whether to serialize or deserialize.
   * @param payload - Data or JSON string to process.
   * @param options - Operation-specific options.
   * @param resolve - Resolver for the caller promise.
   * @param reject - Reject handler for errors.
   * @source
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
      isCancelled: false,
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
   * Serializes data on the main thread as a fallback.
   * @param data - Data to serialize.
   * @param options - Optional serialization settings.
   * @returns Serialization result.
   * @source
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
   * Deserializes JSON on the main thread as a fallback.
   * @param json - JSON string to parse.
   * @param options - Optional deserialization settings.
   * @returns Deserialization result.
   * @source
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
   * Cancels an in-flight JSON serialization or deserialization task.
   * @param taskId - Id of the task to cancel.
   * @source
   */
  cancelTask(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Returns statistics for the shared worker pool.
   * @returns Pool metrics including workers and active tasks.
   * @source
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
   * Terminates all workers in the shared pool.
   * @source
   */
  terminate(): void {
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}

/**
 * Global singleton instance of the JSON serialization worker pool.
 * @source
 */
let jsonSerializationWorkerPoolInstance: JSONSerializationWorkerPool | null =
  null;
/**
 * Tracks initialization to avoid duplicate pool setup.
 * @source
 */
let initializePromise: Promise<void> | null = null;

/**
 * Returns the shared JSON serialization worker pool singleton, initializing it lazily.
 * @param config - Optional config (currently unused).
 * @returns JSON serialization worker pool instance.
 * @source
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
