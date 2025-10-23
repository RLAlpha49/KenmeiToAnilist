/**
 * @packageDocumentation
 * @module shortcuts
 * @description Centralized keyboard shortcuts registry and utilities for the Kenmei to AniList sync tool.
 */

/**
 * Enum for shortcut categories used to organize shortcuts in the UI.
 *
 * @enum {string}
 */
export enum ShortcutCategory {
  NAVIGATION = "Navigation",
  MATCHING = "Matching",
  SYNC = "Sync",
  DEBUG = "Debug",
  GENERAL = "General",
}

/**
 * Represents a keyboard key combination component.
 *
 * @interface ShortcutKey
 * @property {string} key - The keyboard key (e.g., 'z', 'f', '1', '/')
 * @property {boolean} [ctrl] - Whether Ctrl key is required (Windows/Linux)
 * @property {boolean} [shift] - Whether Shift key is required
 * @property {boolean} [alt] - Whether Alt key is required
 * @property {boolean} [meta] - Whether Meta/Cmd key is required (Mac)
 */
interface ShortcutKey {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Represents a complete keyboard shortcut definition with metadata and alternatives.
 *
 * @interface Shortcut
 * @property {string} id - Unique identifier for the shortcut (e.g., 'nav-home', 'match-search')
 * @property {ShortcutCategory} category - Category for organizing shortcuts
 * @property {ShortcutKey} keys - Primary key combination
 * @property {ShortcutKey[]} [altKeys] - Alternative key combinations for the same action
 * @property {string} description - User-facing description of what the shortcut does
 * @property {string} action - Action identifier for dispatcher (e.g., 'navigate:home', 'toggle-search')
 * @property {string} [scope] - Optional scope (e.g., 'matching-page', 'global') for context-aware handling
 */
interface Shortcut {
  id: string;
  category: ShortcutCategory;
  keys: ShortcutKey;
  altKeys?: ShortcutKey[];
  description: string;
  action: string;
  scope?: string;
}

/**
 * Comprehensive registry of all application keyboard shortcuts.
 *
 * Organized by category and sorted by key combination for easy lookup.
 * Serves as the single source of truth for all keyboard shortcuts.
 *
 * @constant SHORTCUTS
 * @type {Shortcut[]}
 */
export const SHORTCUTS: Shortcut[] = [
  // Navigation shortcuts
  {
    id: "nav-home",
    category: ShortcutCategory.NAVIGATION,
    keys: { key: "1", ctrl: true },
    description: "Navigate to Home",
    action: "navigate:home",
    scope: "global",
  },
  {
    id: "nav-import",
    category: ShortcutCategory.NAVIGATION,
    keys: { key: "2", ctrl: true },
    description: "Navigate to Import",
    action: "navigate:import",
    scope: "global",
  },
  {
    id: "nav-review",
    category: ShortcutCategory.NAVIGATION,
    keys: { key: "3", ctrl: true },
    description: "Navigate to Review / Matching",
    action: "navigate:review",
    scope: "global",
  },
  {
    id: "nav-sync",
    category: ShortcutCategory.NAVIGATION,
    keys: { key: "4", ctrl: true },
    description: "Navigate to Sync",
    action: "navigate:sync",
    scope: "global",
  },
  {
    id: "nav-settings",
    category: ShortcutCategory.NAVIGATION,
    keys: { key: "5", ctrl: true },
    description: "Navigate to Settings",
    action: "navigate:settings",
    scope: "global",
  },

  // Matching page shortcuts
  {
    id: "match-search",
    category: ShortcutCategory.MATCHING,
    keys: { key: "f", ctrl: true },
    description: "Focus search input",
    action: "focus:search",
    scope: "matching-page",
  },
  {
    id: "match-undo",
    category: ShortcutCategory.MATCHING,
    keys: { key: "z", ctrl: true },
    description: "Undo last action",
    action: "undo",
    scope: "matching-page",
  },
  {
    id: "match-redo",
    category: ShortcutCategory.MATCHING,
    keys: { key: "z", ctrl: true, shift: true },
    altKeys: [{ key: "y", ctrl: true }],
    description: "Redo last action",
    action: "redo",
    scope: "matching-page",
  },

  // Sync shortcuts
  {
    id: "sync-save",
    category: ShortcutCategory.SYNC,
    keys: { key: "s", ctrl: true },
    description: "Save configuration",
    action: "save:config",
    scope: "context-aware",
  },

  // Debug shortcuts
  {
    id: "debug-menu",
    category: ShortcutCategory.DEBUG,
    keys: { key: "d", ctrl: true, shift: true },
    description: "Open/Toggle debug menu",
    action: "toggle:debug",
    scope: "global",
  },

  // General shortcuts
  {
    id: "general-shortcuts",
    category: ShortcutCategory.GENERAL,
    keys: { key: "?" },
    altKeys: [{ key: "/", ctrl: true }],
    description: "Open shortcuts panel",
    action: "toggle:shortcuts-panel",
    scope: "global",
  },
  {
    id: "general-close",
    category: ShortcutCategory.GENERAL,
    keys: { key: "Escape" },
    description: "Close modals and dialogs",
    action: "close:modal",
    scope: "global",
  },
];

/**
 * Formats a shortcut key combination into a human-readable string.
 *
 * Handles platform-specific key names (Ctrl vs Cmd on Mac).
 * Returns formatted string like "Ctrl+Z", "Cmd+Shift+Z", or "?".
 *
 * @param {ShortcutKey} key - The key combination to format
 * @returns {string} Human-readable shortcut string (e.g., "Ctrl+Z")
 *
 * @example
 * ```tsx
 * const undoKey = { key: 'z', ctrl: true };
 * const keyString = formatShortcutKey(undoKey);
 * // Returns: "Ctrl+Z" on Windows/Linux, "Cmd+Z" on Mac
 * ```
 */
export function formatShortcutKey(key: ShortcutKey): string {
  const parts: string[] = [];
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  if (key.ctrl || key.meta) {
    parts.push(isMac ? "Cmd" : "Ctrl");
  }
  if (key.shift) {
    parts.push("Shift");
  }
  if (key.alt) {
    parts.push("Alt");
  }

  const keyName = key.key === "/" ? "/" : key.key.toUpperCase();
  parts.push(keyName);

  return parts.join("+");
}

/**
 * Checks if a keyboard event matches a specific shortcut definition.
 *
 * Handles both primary and alternative key combinations.
 * Ignores case sensitivity for letter keys and handles platform-specific modifiers.
 *
 * @param {KeyboardEvent} event - The keyboard event to check
 * @param {Shortcut} shortcut - The shortcut definition to match against
 * @returns {boolean} True if the event matches the shortcut
 *
 * @example
 * ```tsx
 * document.addEventListener('keydown', (event) => {
 *   const undoShortcut = SHORTCUTS.find(s => s.id === 'match-undo');
 *   if (matchesShortcut(event, undoShortcut)) {
 *     handleUndo();
 *   }
 * });
 * ```
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  const checkKey = (keyDef: ShortcutKey): boolean => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const keyLower = event.key.toLowerCase();
    const defKeyLower = keyDef.key.toLowerCase();

    // Check key match
    if (keyLower !== defKeyLower) {
      return false;
    }

    // Check modifiers - permissive approach: allow extra modifiers if needed to produce the key
    const hasCtrlOrMeta = event.ctrlKey || event.metaKey;
    const needsCtrl = keyDef.ctrl || (keyDef.meta && isMac);

    // Require Ctrl/Cmd only if specified; don't forbid extra modifiers
    if (needsCtrl && !hasCtrlOrMeta) {
      return false;
    }

    // Shift: require only if specified
    if (keyDef.shift && !event.shiftKey) {
      return false;
    }

    // Alt: require only if specified
    if (keyDef.alt && !event.altKey) {
      return false;
    }

    return true;
  };

  // Check primary key combination
  if (checkKey(shortcut.keys)) {
    return true;
  }

  // Check alternative key combinations
  if (shortcut.altKeys) {
    for (const altKey of shortcut.altKeys) {
      if (checkKey(altKey)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Retrieves all shortcuts in a specific category.
 *
 * Useful for organizing shortcuts in the UI by category.
 *
 * @param {ShortcutCategory} category - The category to filter by
 * @returns {Shortcut[]} Array of shortcuts in the specified category
 *
 * @example
 * ```tsx
 * const navShortcuts = getShortcutsByCategory(ShortcutCategory.NAVIGATION);
 * // Returns array of all navigation shortcuts
 * ```
 */
export function getShortcutsByCategory(category: ShortcutCategory): Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.category === category);
}

/**
 * Finds a shortcut by its unique identifier.
 *
 * @param {string} id - The shortcut ID to find
 * @returns {Shortcut | undefined} The shortcut if found, undefined otherwise
 *
 * @example
 * ```tsx
 * const undoShortcut = getShortcutById('match-undo');
 * if (undoShortcut) {
 *   console.log(`Undo shortcut: ${formatShortcutKey(undoShortcut)}`);
 * }
 * ```
 */
export function getShortcutById(id: string): Shortcut | undefined {
  return SHORTCUTS.find((shortcut) => shortcut.id === id);
}
