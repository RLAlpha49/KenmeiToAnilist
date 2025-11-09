import { normalizationAlgorithmsMap } from "@/utils/normalization";
import type {
  TitleNormalizationMessage,
  TitleNormalizationProgressMessage,
  TitleNormalizationResultMessage,
} from "../../types";
import { getErrorDetails } from "../errorUtils";

function normalizeForAlgorithm(
  algorithm: string,
  titles: string[],
  taskId: string,
): { cache: Record<string, string>; added: Record<string, string> } {
  const algorithmImpl = normalizationAlgorithmsMap[algorithm];
  if (!algorithmImpl) {
    throw new Error(`Unknown normalization algorithm: ${algorithm}`);
  }

  console.debug(
    `[Worker] 🔄 Processing algorithm '${algorithm}' for ${titles.length} titles`,
  );

  const cache: Record<string, string> = {};
  const added: Record<string, string> = {};

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const normalized = algorithmImpl(title);
    cache[title] = normalized;
    added[title] = normalized;

    if ((i + 1) % 100 === 0 || i === titles.length - 1) {
      const progressMsg: TitleNormalizationProgressMessage = {
        type: "TITLE_NORMALIZATION_PROGRESS",
        payload: {
          taskId,
          algorithm,
          current: i + 1,
          total: titles.length,
        },
      };
      console.debug(
        `[Worker] 📊 Normalization progress for '${algorithm}': ${i + 1}/${titles.length}`,
      );
      globalThis.postMessage(progressMsg);
    }
  }

  console.info(
    `[Worker] ✅ Algorithm '${algorithm}' completed for ${titles.length} titles`,
  );

  return { cache, added };
}

export function handleTitleNormalization(
  message: TitleNormalizationMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, titles, algorithms } = message.payload;

  console.info(
    `[Worker] 📚 Starting title normalization for task ${taskId} (${titles.length} titles, algorithms: ${algorithms.join(", ")})`,
  );

  activeTasks.add(taskId);

  try {
    const startTime = performance.now();
    const caches: Record<string, Record<string, string>> = {};
    const deltas: Record<
      string,
      { added: Record<string, string>; modified: Record<string, string> }
    > = {};

    for (const algorithm of algorithms) {
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Title normalization task ${taskId} was cancelled`,
        );
        return;
      }

      const { cache, added } = normalizeForAlgorithm(algorithm, titles, taskId);

      caches[algorithm] = cache;
      deltas[algorithm] = {
        added,
        modified: {},
      };
    }

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Title normalization task ${taskId} was cancelled before completion`,
      );
      return;
    }

    const endTime = performance.now();
    const processingTimeMs = endTime - startTime;

    const resultMsg: TitleNormalizationResultMessage = {
      type: "TITLE_NORMALIZATION_RESULT",
      payload: {
        taskId,
        caches,
        deltas,
        timing: {
          processingTimeMs,
          totalTitlesProcessed: titles.length,
        },
      },
    };

    console.info(
      `[Worker] ✅ Title normalization task ${taskId} completed (${titles.length} titles in ${processingTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in title normalization task ${taskId}:`,
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
