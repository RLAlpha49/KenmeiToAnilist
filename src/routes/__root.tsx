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
 * Root route providing base layout and outlet for all child routes.
 * @source
 */
export const RootRoute = createRootRoute({
  component: Root,
});

/**
 * Root layout component that wraps all pages with the base layout.
 * Manages global keyboard shortcuts and overlay visibility.
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
      // Map shortcut actions to routes
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

  // Handles context-aware save based on current route
  const handleContextSave = useCallback(() => {
    // Save sync config when on sync page
    if (location.pathname === "/sync") {
      const syncConfig = getSyncConfig();
      if (syncConfig) {
        saveSyncConfig(syncConfig);
        toast.success("Sync configuration saved");
      }
    } else if (location.pathname === "/settings") {
      // Save match config when on settings page
      const matchConfig = getMatchConfig();
      if (matchConfig) {
        saveMatchConfig(matchConfig);
        toast.success("Match configuration saved");
      }
    }
  }, [location.pathname]);

  // Handles search focus with data attribute selector
  const handleSearchFocus = useCallback(() => {
    // Try to find search input with data attribute first (for page-specific search)
    let searchInput = document.querySelector(
      "[data-search-input]",
    ) as HTMLInputElement;

    // If not found with general selector, try the specific settings search input
    if (!searchInput && location.pathname === "/settings") {
      searchInput = document.querySelector(
        "[data-search-input='settings']",
      ) as HTMLInputElement;
    }

    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, [location.pathname]);

  // Handles modal close - scoped to shortcuts panel only when open
  const handleCloseModal = useCallback(() => {
    // Only close shortcuts panel with Escape when it's the active dialog
    // This prevents interfering with nested Radix modals or page-level Escape handling
    if (isShortcutsPanelOpen) {
      setIsShortcutsPanelOpen(false);
    }
    // Other modal closing is handled by their respective components or Radix Dialog
  }, [isShortcutsPanelOpen]);

  // Global keyboard shortcuts listener
  useEffect(() => {
    const isShortcutInScope = (shortcut: (typeof SHORTCUTS)[0]): boolean => {
      // Skip page-scoped shortcuts unless on the correct route
      if (
        shortcut.scope === "matching-page" &&
        location.pathname !== "/review"
      ) {
        return false;
      }

      // Skip settings-page scoped shortcuts unless on settings route
      if (
        shortcut.scope === "settings-page" &&
        location.pathname !== "/settings"
      ) {
        return false;
      }

      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Special case: Handle Escape to close ShortcutsPanel only when it's open
      // This must be done before other shortcut processing to avoid conflicts
      if (event.key === "Escape" && isShortcutsPanelOpen) {
        event.preventDefault();
        event.stopPropagation();
        handleCloseModal();
        return;
      }

      // Skip if focus is in input or textarea (allow native keyboard handling)
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const dispatchShortcutAction = (action: string): boolean => {
        if (action.startsWith("navigate:")) {
          handleNavigationShortcut(action);
          return true;
        }

        switch (action) {
          case "focus:search":
            handleSearchFocus();
            return true;
          case "focus:settings-search":
            // Focus the settings search input using the data attribute
            if (location.pathname === "/settings") {
              const settingsSearchInput = document.querySelector(
                "[data-search-input='settings']",
              ) as HTMLInputElement;
              if (settingsSearchInput) {
                settingsSearchInput.focus();
                settingsSearchInput.select();
                return true;
              }
            }
            return false;
          case "save:config":
            handleContextSave();
            return true;
          case "toggle:debug":
            setDebugEnabled(true);
            openDebugMenu();
            return true;
          case "toggle:shortcuts-panel":
            handleToggleShortcutsPanel();
            return true;
          default:
            return false;
        }
      };

      // Check each shortcut for a match
      for (const shortcut of SHORTCUTS) {
        if (!matchesShortcut(event, shortcut)) continue;

        // Skip if shortcut is not in current scope
        if (!isShortcutInScope(shortcut)) {
          continue;
        }

        // Let page-level handlers take precedence for undo/redo
        // These are intentionally not prevented here; the page must handle preventDefault()
        if (shortcut.action === "undo" || shortcut.action === "redo") return;

        const handled = dispatchShortcutAction(shortcut.action);
        if (handled) {
          event.preventDefault();
          // Stop propagation to prevent duplicate toggles and avoid interfering with nested modals
          event.stopPropagation();
        }

        // Only process one shortcut per keystroke
        break;
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
