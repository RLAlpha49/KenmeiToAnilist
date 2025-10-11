/**
 * @packageDocumentation
 * @module debug_types
 * @description Shared debug-related type definitions.
 */

export type IpcLogDirection = "sent" | "received";

export type IpcLogTransport =
  | "invoke"
  | "invoke-response"
  | "send"
  | "event"
  | "message";

export type IpcLogStatus = "pending" | "fulfilled" | "rejected";

export interface IpcLogPayload {
  raw: unknown;
  preview: string;
}

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
