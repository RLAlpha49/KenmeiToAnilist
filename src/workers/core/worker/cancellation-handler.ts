import type { CancelMessage } from "../types";
import { csvParserStates } from "./operations/csv-operations";

/**
 * Handles cancellation of worker tasks and notifies CSV parsing when applicable.
 * @param message - The cancel message containing the target task ID.
 * @param activeTasks - Collection of currently active task IDs.
 * @source
 */
export function handleCancel(
  message: CancelMessage,
  activeTasks: Set<string>,
): void {
  const { taskId } = message.payload;
  console.debug(`[Worker] ⏹️ Cancel requested for task ${taskId}`);

  const csvState = csvParserStates.get(taskId);
  const hadCSVTask = !!csvState;

  // Ensure local tracking and CSV parser state are cleared for the cancelled task
  activeTasks.delete(taskId);
  csvParserStates.delete(taskId);

  if (hadCSVTask) {
    self.postMessage({
      type: "CSV_CANCELLED",
      payload: { taskId },
    });
  }
}
