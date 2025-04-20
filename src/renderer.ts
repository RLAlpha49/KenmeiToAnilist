/**
 * @packageDocumentation
 * @module renderer
 * @description Entry point for the Electron renderer process. Initializes Sentry for error tracking and loads the main application.
 */
import * as Sentry from "@sentry/electron/renderer";

Sentry.init({
  dsn: (import.meta.env.VITE_SENTRY_DSN as string) || undefined,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});

import "@/App";
