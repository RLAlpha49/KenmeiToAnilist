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
    <ThemeProvider>
      <DebugProvider>
        <AuthProvider>
          <RateLimitProvider>
            <RouterProvider router={router} />
            <SonnerProvider />
          </RateLimitProvider>
        </AuthProvider>
      </DebugProvider>
    </ThemeProvider>
  );
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
