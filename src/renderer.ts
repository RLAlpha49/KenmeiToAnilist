/**
 * @packageDocumentation
 * @module renderer
 * @description Renderer process entry point. Initializes Sentry and mounts the main application.
 * @source
 */
import * as Sentry from "@sentry/electron/renderer";
import { initializeStorage } from "@/utils/storage";

// Initialize Sentry error tracking only if DSN is configured
const sentryDsn = (import.meta.env.VITE_SENTRY_DSN as string) || undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
  });
}

// Initialize storage layer before rendering the app
// This ensures storage keys are properly initialized and ready for providers
try {
  await initializeStorage();
  console.info("[Renderer] ✅ Storage initialized successfully");
} catch (error) {
  console.error("[Renderer] ❌ Storage initialization failed:", error);
  // Still mount app as fallback, using in-memory storage
}

// Mount the React application after storage is ready
import("@/App");
