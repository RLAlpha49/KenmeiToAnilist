/**
 * @packageDocumentation
 * @module root-route
 * @description Root route and layout for the application, providing the base layout and outlet for child routes.
 */

import React, { useState, useEffect, useCallback, Suspense } from "react";
import BaseLayout from "../components/layout/BaseLayout";
import {
  Outlet,
  createRootRoute,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { ShortcutsPanel } from "../components/ShortcutsPanel";
import { SHORTCUTS, matchesShortcut } from "../utils/shortcuts";
import { useDebugActions } from "../contexts/DebugContext";
import {
  saveSyncConfig,
  getSyncConfig,
  saveMatchConfig,
  getMatchConfig,
} from "../utils/storage";
import { toast } from "sonner";
import { PageLoadingFallback } from "../components/ui/loading-fallback";

/**
 * The root route for the application, providing the base layout and outlet for all child routes.
 *
 * @source
 */
export const RootRoute = createRootRoute({
  component: Root,
});

/**
 * The root layout component that wraps all pages with the base layout and renders the route outlet.
 *
 * Manages global keyboard shortcuts and the shortcuts panel overlay.
 * Coordinates with page-level shortcuts to avoid conflicts.
 *
 * @internal
 * @source
 */
export function Root() {
  const [isShortcutsPanelOpen, setIsShortcutsPanelOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleDebug, setDebugEnabled, openDebugMenu } = useDebugActions();

  const handleToggleShortcutsPanel = useCallback(() => {
    setIsShortcutsPanelOpen((prev) => !prev);
  }, []);

  // Handles navigation shortcuts
  const handleNavigationShortcut = useCallback(
    (action: string) => {
      const routes: Record<string, string> = {
        "navigate:home": "/",
        "navigate:import": "/import",
        "navigate:review": "/review",
        "navigate:sync": "/sync",
        "navigate:statistics": "/statistics",
        "navigate:settings": "/settings",
      };
      if (routes[action]) {
        navigate({ to: routes[action] });
      }
    },
    [navigate],
  );

  // Handles context-aware save
  const handleContextSave = useCallback(() => {
    if (location.pathname === "/sync") {
      const syncConfig = getSyncConfig();
      if (syncConfig) {
        saveSyncConfig(syncConfig);
        toast.success("Sync configuration saved");
      }
    } else if (location.pathname === "/settings") {
      const matchConfig = getMatchConfig();
      if (matchConfig) {
        saveMatchConfig(matchConfig);
        toast.success("Match configuration saved");
      }
    }
  }, [location.pathname]);

  // Handles search focus
  const handleSearchFocus = useCallback(() => {
    const searchInput = document.querySelector(
      "[data-search-input]",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }, []);

  // Handles modal close
  const handleCloseModal = useCallback(() => {
    // Only close modals when shortcuts panel is open
    if (isShortcutsPanelOpen) {
      setIsShortcutsPanelOpen(false);
    }
    // Otherwise let Radix Dialog handle Escape naturally
  }, [isShortcutsPanelOpen]);

  // Global keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if focus is in input or textarea (allow native keyboard handling)
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check each shortcut for a match
      for (const shortcut of SHORTCUTS) {
        if (matchesShortcut(event, shortcut)) {
          // Skip page-scoped shortcuts unless on the correct route
          if (
            shortcut.scope === "matching-page" &&
            location.pathname !== "/review"
          ) {
            continue;
          }

          // Let page-level handlers take precedence for undo/redo
          if (shortcut.action === "undo" || shortcut.action === "redo") {
            return;
          }

          // For close:modal, only prevent default if we're actually handling it
          let isHandled = false;

          // Dispatch action handlers
          if (shortcut.action.startsWith("navigate:")) {
            handleNavigationShortcut(shortcut.action);
            isHandled = true;
          } else if (shortcut.action === "focus:search") {
            handleSearchFocus();
            isHandled = true;
          } else if (shortcut.action === "save:config") {
            handleContextSave();
            isHandled = true;
          } else if (shortcut.action === "toggle:debug") {
            // Ensure debug mode is enabled and open the debug menu
            setDebugEnabled(true);
            openDebugMenu();
            isHandled = true;
          } else if (shortcut.action === "toggle:shortcuts-panel") {
            handleToggleShortcutsPanel();
            isHandled = true;
          } else if (shortcut.action === "close:modal") {
            // Only handle if shortcuts panel is open
            if (isShortcutsPanelOpen) {
              handleCloseModal();
              isHandled = true;
            }
          }

          if (isHandled) {
            event.preventDefault();
          }

          // Only process one shortcut per keystroke
          break;
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [
    handleNavigationShortcut,
    handleSearchFocus,
    handleContextSave,
    toggleDebug,
    handleToggleShortcutsPanel,
    handleCloseModal,
    location.pathname,
    isShortcutsPanelOpen,
  ]);

  return (
    <BaseLayout>
      <Suspense fallback={<PageLoadingFallback />}>
        <Outlet />
      </Suspense>

      <ShortcutsPanel
        isOpen={isShortcutsPanelOpen}
        onClose={() => setIsShortcutsPanelOpen(false)}
      />
    </BaseLayout>
  );
}
