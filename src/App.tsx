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
import { AnimatePresence } from "framer-motion";
import { UpdateNotification } from "./components/UpdateNotification";
import { useAutoUpdater } from "./hooks/useAutoUpdater";

/**
 * Main application component that wraps the router with context providers.
 * @returns The root React element with all providers configured.
 * @source
 */
export default function App() {
  const {
    updateAvailable,
    updateInfo,
    downloadProgress,
    isDownloading,
    isDownloaded,
    error,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  } = useAutoUpdater();

  return (
    <ErrorBoundary>
      <DebugProvider>
        <ThemeProvider>
          <AuthProvider>
            <RateLimitProvider>
              <RouterProvider router={router} />
              <SonnerProvider />

              {/* Update Notification Overlay */}
              <AnimatePresence>
                {updateAvailable && updateInfo && (
                  <div className="fixed bottom-4 right-4 z-50 max-w-md">
                    <UpdateNotification
                      version={updateInfo.version}
                      releaseNotes={updateInfo.releaseNotes}
                      releaseDate={updateInfo.releaseDate}
                      downloadProgress={downloadProgress}
                      isDownloading={isDownloading}
                      isDownloaded={isDownloaded}
                      error={error ?? undefined}
                      onDownload={downloadUpdate}
                      onInstall={installUpdate}
                      onDismiss={dismissUpdate}
                    />
                  </div>
                )}
              </AnimatePresence>
            </RateLimitProvider>
          </AuthProvider>
        </ThemeProvider>
      </DebugProvider>
    </ErrorBoundary>
  );
}

// Initialize storage layer before rendering the app
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
