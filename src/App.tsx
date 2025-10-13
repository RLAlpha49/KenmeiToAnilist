/**
 * @packageDocumentation
 * @module App
 * @description Main React application entry point. Sets up providers and mounts the router for the KenmeiToAnilist app.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { router } from "./routes/router";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { SonnerProvider } from "./components/ui/sonner-provider";
import { RateLimitProvider } from "./contexts/RateLimitContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DebugProvider } from "./contexts/DebugContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initializeStorage } from "./utils/storage";

/**
 * The main application component for KenmeiToAnilist.
 *
 * Sets up theme, authentication, rate limit, and notification providers, and renders the router.
 *
 * @returns The root React element for the application.
 * @source
 */
export default function App() {
  return (
    <ErrorBoundary>
      <DebugProvider>
        <ThemeProvider>
          <AuthProvider>
            <RateLimitProvider>
              <RouterProvider router={router} />
              <SonnerProvider />
            </RateLimitProvider>
          </AuthProvider>
        </ThemeProvider>
      </DebugProvider>
    </ErrorBoundary>
  );
}

// Initialize storage synchronization before mounting the app
initializeStorage()
  .then(() => {
    console.info("[App] ✅ Storage initialized successfully");
  })
  .catch((error) => {
    console.error("[App] ❌ Storage initialization failed:", error);
  });

// Mount the application if the root container is available
const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
