import * as Sentry from "@sentry/electron/renderer";

Sentry.init({
  dsn: (import.meta.env.VITE_SENTRY_DSN as string) || undefined,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});

import "@/App";
