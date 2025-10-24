/**
 * @packageDocumentation
 * @module renderer
 * @description Renderer process entry point. Initializes Sentry and mounts the main application.
 * @source
 */
import * as Sentry from "@sentry/electron/renderer";

// Initialize Sentry error tracking only if DSN is configured
const sentryDsn = (import.meta.env.VITE_SENTRY_DSN as string) || undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
  });
}

// Mount the React application
import "@/App";
