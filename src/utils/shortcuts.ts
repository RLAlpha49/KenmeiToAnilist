/**
 * @packageDocumentation
 * @module shortcuts
 * @description Centralized keyboard shortcuts registry and utilities for the Kenmei to AniList sync tool.
 */

/**
 * Categories for organizing keyboard shortcuts in the UI.
 * @source
 */
export enum ShortcutCategory {
  NAVIGATION = "NAVIGATION",
  MATCHING = "MATCHING",
  SYNC = "SYNC",
  DEBUG = "DEBUG",
  GENERAL = "GENERAL",
}

/**
 * Keyboard key combination component with optional modifier flags.
 * @source
 */
interface ShortcutKey {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Complete keyboard shortcut definition with metadata, primary keys, and alternative combinations.
 * @source
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
 * Organized by category.
 * @source
 */
const makeShortcut = (
  base: Pick<Shortcut, "id" | "category" | "keys" | "description" | "action"> &
    Partial<Pick<Shortcut, "altKeys" | "scope">>,
): Shortcut => ({
  scope: "global",
  ...base,
});

/* Navigation shortcuts */
const NAV_ITEMS: Array<{
  id: string;
  key: string;
  description: string;
  action: string;
}> = [
  {
    id: "nav-home",
    key: "1",
    description: "Navigate to Home",
    action: "navigate:home",
  },
  {
    id: "nav-import",
    key: "2",
    description: "Navigate to Import",
    action: "navigate:import",
  },
  {
    id: "nav-review",
    key: "3",
    description: "Navigate to Review / Matching",
    action: "navigate:review",
  },
  {
    id: "nav-sync",
    key: "4",
    description: "Navigate to Sync",
    action: "navigate:sync",
  },
  {
    id: "nav-statistics",
    key: "5",
    description: "Navigate to Statistics",
    action: "navigate:statistics",
  },
  {
    id: "nav-settings",
    key: "6",
    description: "Navigate to Settings",
    action: "navigate:settings",
  },
];

const NAV_SHORTCUTS: Shortcut[] = NAV_ITEMS.map((item) =>
  makeShortcut({
    id: item.id,
    category: ShortcutCategory.NAVIGATION,
    keys: { key: item.key, ctrl: true },
    description: item.description,
    action: item.action,
    scope: "global",
  }),
);

/* Matching page shortcuts */
const MATCHING_SHORTCUTS: Shortcut[] = [
  makeShortcut({
    id: "match-search",
    category: ShortcutCategory.MATCHING,
    keys: { key: "f", ctrl: true },
    description: "Focus search input",
    action: "focus:search",
    scope: "matching-page",
  }),
  makeShortcut({
    id: "match-select-all",
    category: ShortcutCategory.MATCHING,
    keys: { key: "a", ctrl: true },
    description: "Select all visible matches",
    action: "select-all:matches",
    scope: "matching-page",
  }),
  makeShortcut({
    id: "match-clear-selection",
    category: ShortcutCategory.MATCHING,
    keys: { key: "Escape" },
    description: "Clear current selection",
    action: "clear-selection",
    scope: "matching-page",
  }),
  makeShortcut({
    id: "match-undo",
    category: ShortcutCategory.MATCHING,
    keys: { key: "z", ctrl: true },
    description: "Undo last action",
    action: "undo",
    scope: "matching-page",
  }),
  makeShortcut({
    id: "match-redo",
    category: ShortcutCategory.MATCHING,
    keys: { key: "z", ctrl: true, shift: true },
    altKeys: [{ key: "y", ctrl: true }],
    description: "Redo last action",
    action: "redo",
    scope: "matching-page",
  }),
];

/* Settings search */
const SETTINGS_SHORTCUT: Shortcut = makeShortcut({
  id: "settings-search",
  category: ShortcutCategory.GENERAL,
  keys: { key: "f", ctrl: true },
  description: "Focus settings search input",
  action: "focus:settings-search",
  scope: "settings-page",
});

/* Sync shortcuts */
const SYNC_SHORTCUTS: Shortcut[] = [
  makeShortcut({
    id: "sync-save",
    category: ShortcutCategory.SYNC,
    keys: { key: "s", ctrl: true },
    description: "Save configuration",
    action: "save:config",
    scope: "context-aware",
  }),
];

/* Debug shortcuts */
const DEBUG_SHORTCUTS: Shortcut[] = [
  makeShortcut({
    id: "debug-menu",
    category: ShortcutCategory.DEBUG,
    keys: { key: "d", ctrl: true, shift: true },
    description: "Open/Toggle debug menu",
    action: "toggle:debug",
    scope: "global",
  }),
];

/* General shortcuts */
const GENERAL_SHORTCUTS: Shortcut[] = [
  makeShortcut({
    id: "general-shortcuts",
    category: ShortcutCategory.GENERAL,
    keys: { key: "?" },
    altKeys: [{ key: "/", ctrl: true }],
    description: "Open shortcuts panel",
    action: "toggle:shortcuts-panel",
    scope: "global",
  }),
];

/* Combined registry */
export const SHORTCUTS: Shortcut[] = [
  ...NAV_SHORTCUTS,
  ...MATCHING_SHORTCUTS,
  SETTINGS_SHORTCUT,
  ...SYNC_SHORTCUTS,
  ...DEBUG_SHORTCUTS,
  ...GENERAL_SHORTCUTS,
];

/**
 * Formats key combination into human-readable string with platform-specific key names.
 *
 * **Important**: `ctrl` and `meta` modifiers are treated equivalently for labeling purposes.
 * If both are set, only "Ctrl" (or "Cmd" on macOS) will appear in the output, regardless of
 * which modifier(s) are actually set. For precise control over labeling on specific platforms,
 * consider using a single modifier flag rather than relying on the automatic platform detection.
 *
 * Platform handling:
 * - **macOS/iOS**: Displays "Cmd" instead of "Ctrl"
 * - **Other platforms**: Displays "Ctrl"
 *
 * @param key - The key combination to format.
 * @returns Human-readable shortcut string (e.g., "Ctrl+Z", "Cmd+Shift+S").
 * @source
 */
export function formatShortcutKey(key: ShortcutKey): string {
  const parts: string[] = [];
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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
 * Checks if keyboard event matches shortcut definition; supports primary and alternative key combinations.
 * Enforces exact modifier matching (only specified modifiers required; unspecified forbidden except for symbol Shift).
 * @param event - The keyboard event to check.
 * @param shortcut - The shortcut definition to match against.
 * @returns True if event matches the shortcut; false otherwise.
 * @source
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  const checkKey = (keyDef: ShortcutKey): boolean => {
    // Normalize the keys for comparison (case-insensitive for letters)
    const eventKeyLower = event.key.toLowerCase();
    const defKeyLower = keyDef.key.toLowerCase();

    // Check key match - handle special characters and letters
    if (eventKeyLower !== defKeyLower) {
      return false;
    }

    // Compute expected modifier set from the definition
    const expectedCtrl = keyDef.ctrl === true;
    const expectedMeta = keyDef.meta === true;
    const expectedShift = keyDef.shift === true;
    const expectedAlt = keyDef.alt === true;

    // On Mac, Cmd is treated equivalently to Ctrl
    const hasCtrl = event.ctrlKey;
    const hasMeta = event.metaKey;
    const expectedCtrlOrMeta = expectedCtrl || expectedMeta;
    const hasCtrlOrMeta = hasCtrl || hasMeta;

    // Require Ctrl/Cmd only if specified
    if (expectedCtrlOrMeta && !hasCtrlOrMeta) {
      return false;
    }
    // Forbid Ctrl/Cmd if not specified
    if (!expectedCtrlOrMeta && hasCtrlOrMeta) {
      return false;
    }

    // Require Shift only if specified
    if (expectedShift && !event.shiftKey) {
      return false;
    }
    // Exception: allow Shift for symbol keys that may require it on some layouts
    // (e.g., '?' is Shift+/ on US layouts)
    const isSymbolKey = /[!@#$%^&*()_+=[\]{};:'",.<>?/\\|`~-]/.test(keyDef.key);
    if (!expectedShift && event.shiftKey && !isSymbolKey) {
      return false;
    }

    // Require Alt only if specified
    if (expectedAlt && !event.altKey) {
      return false;
    }
    // Forbid Alt if not specified
    if (!expectedAlt && event.altKey) {
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
 * Retrieves all shortcuts in a specific category; useful for UI organization by category.
 * @param category - The category to filter by.
 * @returns Array of shortcuts in the specified category.
 * @source
 */
export function getShortcutsByCategory(category: ShortcutCategory): Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.category === category);
}

/**
 * Humanizes a scope value for display in UI.
 * Converts machine-readable scope names to human-friendly labels.
 * @param scope - The raw scope value (e.g., "matching-page", "context-aware").
 * @returns Human-friendly label (e.g., "Matching Page", "Context-Aware").
 * @source
 */
export function humanizeScope(scope?: string): string {
  if (!scope || scope === "global") {
    return "Global";
  }

  return scope
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Finds shortcut by unique identifier.
 * @param id - The shortcut ID to find.
 * @returns The shortcut if found; undefined otherwise.
 * @source
 */
export function getShortcutById(id: string): Shortcut | undefined {
  return SHORTCUTS.find((shortcut) => shortcut.id === id);
}
