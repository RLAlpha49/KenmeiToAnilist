/**
 * @packageDocumentation
 * @module renderer
 * @description Renderer process initialization script.
 * Initializes Sentry error tracking and the application storage layer before rendering React.
 * @source
 */
import * as Sentry from "@sentry/electron/renderer";
import { initializeStorage } from "@/utils/storage";
import { installConsoleInterceptor } from "@/utils/logging";

/**
 * Initialize Sentry error tracking if DSN is configured.
 * Captures errors and sends them to Sentry for monitoring and debugging.
 * @source
 */
const sentryDsn = (import.meta.env.VITE_SENTRY_DSN as string) || undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Sanitize sensitive data
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
      if (event.extra) {
        delete event.extra.token;
        delete event.extra.apiKey;
      }
      return event;
    },
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "Network request failed",
      "Failed to fetch",
    ],
  });
}

/**
 * Install console interceptor to capture all console output for debugging.
 * Gated behind VITE_CAPTURE_CONSOLE environment flag.
 * Enabled by default in production, can be enabled in development via VITE_CAPTURE_CONSOLE=1.
 * @source
 */
let cleanupConsoleInterceptor: (() => void) | null = null;

// Determine if console interceptor should be enabled
const shouldCaptureConsole =
  import.meta.env.MODE === "production" ||
  import.meta.env.VITE_CAPTURE_CONSOLE === "1";

if (shouldCaptureConsole) {
  try {
    cleanupConsoleInterceptor = installConsoleInterceptor();
    if (import.meta.env.MODE !== "production") {
      console.debug(
        "[Renderer] 🔍 Console interceptor enabled via VITE_CAPTURE_CONSOLE",
      );
    }
  } catch (error) {
    console.warn("[Renderer] ⚠️ Failed to install console interceptor:", error);
  }
}

// Always register cleanup on unload
window.addEventListener("unload", () => {
  if (cleanupConsoleInterceptor) {
    cleanupConsoleInterceptor();
  }
});

/**
 * Initialize the storage abstraction layer.
 * Sets up storage keys and initializes the backend storage mechanism (electron-store or localStorage).
 * This must complete before rendering the application to ensure all storage operations are ready.
 * @source
 */
try {
  await initializeStorage();
  console.info("[Renderer] ✅ Storage initialized successfully");
} catch (error) {
  console.error("[Renderer] ❌ Storage initialization failed:", error);
  // App continues with fallback in-memory storage if initialization fails
}

// Load and render the React application after storage is ready
import("@/App");
