/**
 * @packageDocumentation
 * @module renderer
 * @description Renderer process initialization script.
 * Initializes Sentry error tracking and the application storage layer before rendering React.
 * @source
 */
import * as Sentry from "@sentry/electron/renderer";
import { initializeStorage } from "@/utils/storage";

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
  });
}

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
