/**
 * @packageDocumentation
 * @module debug_types
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
 * Represents a serialized IPC message payload with preview.
 *
 * @property raw - The raw payload data.
 * @property preview - A string representation for display purposes.
 * @source
 */
export interface IpcLogPayload {
  raw: unknown;
  preview: string;
}

/**
 * Represents a single IPC communication log entry.
 *
 * @property id - Unique identifier for this log entry.
 * @property correlationId - Identifier linking request-response pairs.
 * @property channel - The IPC channel name.
 * @property direction - Whether message was sent or received.
 * @property transport - The type of IPC transport used.
 * @property status - The operation status (pending/fulfilled/rejected).
 * @property timestamp - ISO timestamp of when the message was logged.
 * @property durationMs - Time taken for operation to complete.
 * @property payload - The message payload and preview.
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
 * Represents a generic debug event record.
 *
 * @property type - The event type identifier.
 * @property message - The event message.
 * @property level - The severity level.
 * @property source - The source component or module.
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
 * Represents a debug event with a generated unique identifier.
 *
 * Extends DebugEventRecord with an id and ensures a timestamp is always present.
 *
 * @source
 */
export interface DebugEventEntry extends DebugEventRecord {
  id: string;
  timestamp: string;
}
