import type { CancelMessage } from "../types";
import { csvParserStates } from "./operations/csvOperations";

export function handleCancel(
  message: CancelMessage,
  activeTasks: Set<string>,
): void {
  const { taskId } = message.payload;
  console.debug(`[Worker] ⏹️ Cancel requested for task ${taskId}`);

  const csvState = csvParserStates.get(taskId);
  const hadCSVTask = !!csvState;

  activeTasks.delete(taskId);
  csvParserStates.delete(taskId);

  if (hadCSVTask) {
    self.postMessage({
      type: "CSV_CANCELLED",
      payload: { taskId },
    });
  }
}
