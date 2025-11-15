/**
 * Safe openExternal helper used by renderer components.
 * Ensures we always call into the main process shell API when available and
 * fall back to window.open when not in Electron environments.
 */
export async function openExternalSafe(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { success: false, error: "Invalid URL" };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { success: false, error: "Unsupported URL protocol" };
    }

    // Prefer secure shell API in Electron main process
    if (globalThis.electronAPI?.shell?.openExternal) {
      try {
        const res = await globalThis.electronAPI.shell.openExternal(url);
        if (!res?.success) {
          return { success: false, error: res?.error || "Unknown error" };
        }
        return { success: true };
      } catch (err) {
        // Don't return raw error objects to callers; return a concise message
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          "[openExternalSafe] electronAPI.shell.openExternal failed:",
          message,
        );
        // Fallback to window.open for non-Electron contexts
        if (typeof globalThis.open === "function") {
          try {
            globalThis.open(url, "_blank", "noopener,noreferrer");
            return { success: true };
          } catch {
            return { success: false, error: message };
          }
        }
        return { success: false, error: message };
      }
    }

    // Fallback: window.open (browser)
    if (typeof globalThis.open === "function") {
      try {
        globalThis.open(url, "_blank", "noopener,noreferrer");
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[openExternalSafe] window.open failed:", message);
        return { success: false, error: message };
      }
    }

    return {
      success: false,
      error: "No available method to open external URL",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[openExternalSafe] Unexpected error:", message);
    return { success: false, error: message };
  }
}
