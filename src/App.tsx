/**
 * @packageDocumentation
 * @module App
 * @description Main React application component.
 * Sets up all context providers, routing, and UI overlays for the KenmeiToAnilist application.
 * @source
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { router } from "./routes/router";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./contexts/auth-context";
import { OnboardingProvider } from "./contexts/onboarding-context";
import { SonnerProvider } from "./components/ui/SonnerProvider";
import { RateLimitProvider } from "./contexts/rate-limit-context";
import { ThemeProvider } from "./contexts/theme-context";
import { DebugProvider } from "./contexts/debug-context";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import { UpdateNotification } from "./components/UpdateNotification";
import { OnboardingOverlay } from "./components/onboarding/OnboardingOverlay";
import { useAutoUpdater } from "./hooks/use-auto-updater";
import { TooltipProvider } from "./components/ui/Tooltip";

/**
 * Main application content with all providers and UI layers.
 * Renders the router with context providers, notifications, and overlays.
 * @returns Root React element with nested providers and router.
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
                <TooltipProvider>
                  <RouterProvider router={router} />
                  <SonnerProvider />
                  <OnboardingOverlay
                    position="bottom-left"
                    shouldShowProgress={true}
                  />

                  {/* Display update notification when available */}
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
                </TooltipProvider>
              </OnboardingProvider>
            </RateLimitProvider>
          </AuthProvider>
        </ThemeProvider>
      </DebugProvider>
    </ErrorBoundary>
  );
}

/**
 * Splash screen displayed during storage initialization.
 * Shows a loading spinner with initialization message.
 * @returns Splash screen UI element.
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
 * Application wrapper component.
 * Ensures storage is initialized and handles React strict mode rendering.
 * Storage initialization occurs in renderer.ts before this component mounts.
 * @returns Application content or splash screen.
 * @source
 */
export default function App() {
  // State tracks if storage is ready; normally true immediately
  // Used to handle strict mode remounting in development
  const [isStorageReady, setIsStorageReady] = React.useState(true);

  React.useEffect(() => {
    // Storage should already be initialized by renderer.ts before App mounts
    // This state ensures proper hydration in React strict mode
    setIsStorageReady(true);
  }, []);

  if (!isStorageReady) {
    return <StorageSplash />;
  }

  return <AppContent />;
}

/**
 * Mount the React application to the DOM.
 * Renders the App component in strict mode for development safety checks.
 * @source
 */
const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
