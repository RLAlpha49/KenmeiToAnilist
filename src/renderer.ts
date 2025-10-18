/**
 * @packageDocumentation
 * @module renderer
 * @description Renderer process entry point. Initializes Sentry and mounts the main application.
 * @source
 */
import * as Sentry from "@sentry/electron/renderer";

// Initialize Sentry error tracking with environment-specific configuration
Sentry.init({
  dsn: (import.meta.env.VITE_SENTRY_DSN as string) || undefined,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});

// Mount the React application
import "@/App";
