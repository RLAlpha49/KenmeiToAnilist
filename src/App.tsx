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
import { OnboardingProvider } from "./contexts/OnboardingContext";
import { SonnerProvider } from "./components/ui/sonner-provider";
import { RateLimitProvider } from "./contexts/RateLimitContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DebugProvider } from "./contexts/DebugContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import { UpdateNotification } from "./components/UpdateNotification";
import { OnboardingOverlay } from "./components/onboarding/OnboardingOverlay";
import { useAutoUpdater } from "./hooks/useAutoUpdater";

/**
 * Main application component that wraps the router with context providers.
 * @returns The root React element with all providers configured.
 * @source
 */
function AppContent() {
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
              <OnboardingProvider>
                <RouterProvider router={router} />
                <SonnerProvider />
                <OnboardingOverlay position="bottom-left" showProgress={true} />

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
              </OnboardingProvider>
            </RateLimitProvider>
          </AuthProvider>
        </ThemeProvider>
      </DebugProvider>
    </ErrorBoundary>
  );
}

/**
 * Splash screen shown while storage is being initialized.
 * @returns A minimal splash screen UI
 * @source
 */
function StorageSplash() {
  return (
    <div className="bg-linear-to-br flex h-screen w-screen items-center justify-center from-slate-950 to-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
        <p className="text-sm text-slate-400">Initializing storage...</p>
      </div>
    </div>
  );
}

/**
 * App wrapper that ensures storage is initialized before rendering content.
 * Storage is initialized by renderer.ts before this component mounts.
 * @returns The app content
 * @source
 */
export default function App() {
  const [isStorageReady, setIsStorageReady] = React.useState(true);

  React.useEffect(() => {
    // Storage should already be initialized by renderer.ts before App mounts
    // This state ensures proper hydration in strict mode
    setIsStorageReady(true);
  }, []);

  if (!isStorageReady) {
    return <StorageSplash />;
  }

  return <AppContent />;
}

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
