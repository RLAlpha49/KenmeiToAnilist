/**
 * @packageDocumentation
 * @module debug-types
 * @description Shared debug-related type definitions.
 */

/** Direction of IPC communication (sent from or received by this process). @source */
export type IpcLogDirection = "sent" | "received";

/** Type of IPC transport mechanism used. @source */
export type IpcLogTransport =
  | "invoke"
  | "invoke-response"
  | "send"
  | "event"
  | "message";

/** Status of an IPC operation (pending, fulfilled, or rejected). @source */
export type IpcLogStatus = "pending" | "fulfilled" | "rejected";

/**
 * Serialized IPC message payload with preview.
 *
 * @property raw - Raw payload data.
 * @property preview - String representation for display.
 * @source
 */
export interface IpcLogPayload {
  raw: unknown;
  preview: string;
}

/**
 * Single IPC communication log entry.
 *
 * @property id - Unique identifier for this log entry.
 * @property correlationId - Identifier linking request-response pairs.
 * @property channel - IPC channel name.
 * @property direction - Message direction (sent or received).
 * @property transport - Type of IPC transport used.
 * @property status - Operation status (pending/fulfilled/rejected).
 * @property timestamp - ISO timestamp of the log entry.
 * @property durationMs - Time taken for operation to complete.
 * @property payload - Message payload and preview.
 * @property error - Error message if the operation failed.
 * @source
 */
export interface IpcLogEntry {
  id: string;
  correlationId?: string;
  channel: string;
  direction: IpcLogDirection;
  transport: IpcLogTransport;
  status?: IpcLogStatus;
  timestamp: string;
  durationMs?: number;
  payload: IpcLogPayload;
  error?: string;
}

/** Severity level for debug event records. @source */
export type DebugEventLevel = "info" | "warn" | "error" | "success" | "debug";

/**
 * Generic debug event record.
 *
 * @property type - Event type identifier.
 * @property message - Event message.
 * @property level - Severity level.
 * @property source - Source component or module.
 * @property context - Additional contextual information.
 * @property metadata - Key-value metadata for the event.
 * @property tags - Array of tags for categorization.
 * @property timestamp - ISO timestamp of the event.
 * @source
 */
export interface DebugEventRecord {
  type: string;
  message: string;
  level?: DebugEventLevel;
  source?: string;
  context?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  timestamp?: string;
}

/**
 * Debug event with a generated unique identifier.
 *
 * Extends DebugEventRecord with an id and ensures timestamp is always present.
 *
 * @source
 */
export interface DebugEventEntry extends DebugEventRecord {
  id: string;
  timestamp: string;
}

/**
 * API request latency sample with context.
 *
 * @property duration - Request duration in milliseconds.
 * @property provider - API provider (e.g., "anilist", "mal").
 * @property endpoint - API endpoint or operation name (e.g., "search_manga").
 * @source
 */
export interface ApiLatencySample {
  duration: number;
  provider: string;
  endpoint?: string;
}

/**
 * API performance metrics tracking request latency and success rates.
 * @source
 */
export interface ApiPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number; // milliseconds
  minLatency: number; // milliseconds
  maxLatency: number; // milliseconds
  recentLatencies: number[]; // Last 100 requests for trend visualization
  recentSamples: ApiLatencySample[]; // Last 100 requests with context
  errorRate: number; // percentage (0-100)
}

/**
 * Cache performance metrics tracking hit rates and efficiency.
 * @source
 */
export interface CachePerformanceMetrics {
  hits: number;
  misses: number;
  hitRate: number; // percentage (0-100)
  totalSize: number; // number of cached entries
  inMemorySize: number;
  localStorageSize: number;
}

/**
 * Matching process performance metrics tracking speed and throughput.
 * @source
 */
export interface MatchingPerformanceMetrics {
  totalMatched: number;
  averageSpeed: number; // titles per minute
  currentSpeed: number; // real-time speed (titles per minute)
  totalDuration: number; // milliseconds
  lastUpdateTimestamp: number;
}

/**
 * Memory usage metrics from Electron process APIs.
 * @source
 */
export interface MemoryMetrics {
  private: number;
  shared: number;
  heap: number;
  timestamp: number;
}

/**
 * Complete performance metrics snapshot.
 * @source
 */
export interface PerformanceMetrics {
  api: ApiPerformanceMetrics;
  cache: CachePerformanceMetrics;
  matching: MatchingPerformanceMetrics;
  memory: {
    current: MemoryMetrics | null;
    history: MemoryMetrics[]; // Last 50 samples for trend chart
  };
  sessionStartTime: number; // When metrics collection started
}

/**
 * Default/initial performance metrics state.
 * @source
 */
export const DEFAULT_PERFORMANCE_METRICS: PerformanceMetrics = {
  api: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    recentLatencies: [],
    recentSamples: [],
    errorRate: 0,
  },
  cache: {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    inMemorySize: 0,
    localStorageSize: 0,
  },
  matching: {
    totalMatched: 0,
    averageSpeed: 0,
    currentSpeed: 0,
    totalDuration: 0,
    lastUpdateTimestamp: 0,
  },
  memory: {
    current: null,
    history: [],
  },
  sessionStartTime: Date.now(),
};
