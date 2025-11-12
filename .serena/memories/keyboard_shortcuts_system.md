# Keyboard Shortcuts System

## Overview

The application implements a comprehensive keyboard shortcuts system that supports dynamic shortcuts, context-aware scopes, and customizable key bindings. Shortcuts are organized by category and context for intuitive user experience.

## Architecture

**Location**: `src/utils/shortcuts.ts`

### Core Types

**Shortcut Definition**:

```typescript
interface Shortcut {
  id: string; // Unique identifier: "matching:accept-match"
  description: string; // "Accept the selected match"
  key: ShortcutKey; // Key combination
  category: ShortcutCategory; // Which section of app
  scope: string[]; // Where applicable: ["matching", "home"]
  action: () => void; // Callback function
}

type ShortcutKey = {
  ctrl?: boolean;  // Ctrl/Cmd
  shift?: boolean; // Shift
  alt?: boolean;   // Alt
  key: string;     // "z", "Enter", "Escape"
};

enum ShortcutCategory {
  GENERAL = "general",
  NAVIGATION = "navigation",
  MATCHING = "matching",
  SYNC = "sync",
  DEBUG = "debug"
}
```

## Shortcut Categories

### General Shortcuts (Global)

**ID**: `general:*`

| Shortcut | Keys | Action |
|----------|------|--------|
| `general:undo` | `Ctrl+Z` / `Cmd+Z` | Undo last action |
| `general:redo` | `Ctrl+Y` / `Cmd+Shift+Z` | Redo action |
| `general:search` | `Ctrl+F` / `Cmd+F` | Open search (context-aware) |
| `general:settings` | `Ctrl+,` / `Cmd+,` | Open settings |
| `general:help` | `F1` | Open help/documentation |
| `general:export` | `Ctrl+E` / `Cmd+E` | Export data |
| `general:import` | `Ctrl+I` / `Cmd+I` | Import data |

**Scope**: All pages

### Navigation Shortcuts

**ID**: `nav:*`

| Shortcut | Keys | Action |
|----------|------|--------|
| `nav:home` | `Ctrl+Home` / `Cmd+Home` | Go to home |
| `nav:import` | `Alt+1` | Go to import page |
| `nav:matching` | `Alt+2` | Go to matching page |
| `nav:sync` | `Alt+3` | Go to sync page |
| `nav:statistics` | `Alt+4` | Go to statistics page |
| `nav:settings` | `Alt+5` | Go to settings page |

**Scope**: All pages

### Matching Page Shortcuts

**ID**: `matching:*`

| Shortcut | Keys | Action |
|----------|------|--------|
| `matching:accept` | `Enter` / `Space` | Accept current match |
| `matching:reject` | `Delete` / `Backspace` | Reject current match |
| `matching:next` | `Down` / `Right` | Next manga |
| `matching:previous` | `Up` / `Left` | Previous manga |
| `matching:search` | `Ctrl+F` / `Cmd+F` | Manual search |
| `matching:reset` | `Ctrl+R` / `Cmd+R` | Reset to pending |
| `matching:select-alt` | `Tab` / `Shift+Tab` | Cycle alternatives |
| `matching:batch-select` | `Ctrl+Click` / `Cmd+Click` | Add to batch |
| `matching:select-all` | `Ctrl+A` / `Cmd+A` | Select all displayed |
| `matching:clear-selection` | `Escape` | Clear batch selection |

**Scope**: Matching page only

### Sync Page Shortcuts

**ID**: `sync:*`

| Shortcut | Keys | Action |
|----------|------|--------|
| `sync:start` | `Ctrl+S` / `Cmd+S` | Start sync |
| `sync:pause` | `Space` | Pause/resume sync |
| `sync:cancel` | `Escape` | Cancel sync |
| `sync:retry` | `Ctrl+Shift+R` | Retry failed entries |
| `sync:export-results` | `Ctrl+E` / `Cmd+E` | Export sync report |

**Scope**: Sync page only

### Debug Shortcuts

**ID**: `debug:*`

| Shortcut | Keys | Action |
|----------|------|--------|
| `debug:toggle` | `F12` / `Cmd+Opt+I` | Toggle debug panel |
| `debug:logs` | `Ctrl+Shift+J` | Show console logs |
| `debug:ipc` | `Ctrl+Shift+K` | Show IPC monitor |
| `debug:state` | `Ctrl+Shift+L` | Show state inspector |
| `debug:performance` | `Ctrl+Shift+P` | Show performance |

**Scope**: All pages (when debug enabled)

## Implementation Details

### Shortcut System API

**`makeShortcut()` Helper**:

```typescript
const shortcut = makeShortcut({
  id: "matching:accept",
  description: "Accept the selected match",
  key: { key: "Enter" },
  category: ShortcutCategory.MATCHING,
  scope: ["matching"],
  action: () => handleAccept()
});
```

**`getShortcutById()`**:

```typescript
const shortcut = getShortcutById("matching:accept");
// Returns: Shortcut object with metadata
```

**`getShortcutsByCategory()`**:

```typescript
const syncShortcuts = getShortcutsByCategory(ShortcutCategory.SYNC);
// Returns: Array of all sync-related shortcuts
```

**`matchesShortcut()`**:

```typescript
// In keyboard event handler
if (matchesShortcut(event, "matching:accept")) {
  handleAccept();
}
```

### Shortcut Constants

**`src/utils/shortcuts.ts` exports**:

```typescript
export const GENERAL_SHORTCUTS = [ ... ];
export const NAV_SHORTCUTS = [ ... ];
export const MATCHING_SHORTCUTS = [ ... ];
export const SYNC_SHORTCUTS = [ ... ];
export const DEBUG_SHORTCUTS = [ ... ];
export const SHORTCUTS = [
  ...GENERAL_SHORTCUTS,
  ...NAV_SHORTCUTS,
  ...MATCHING_SHORTCUTS,
  ...SYNC_SHORTCUTS,
  ...DEBUG_SHORTCUTS
];
```

### Platform Detection

**Key formatting**:

```typescript
const PLATFORM = {
  ctrl: isMac ? "Cmd" : "Ctrl",
  alt: isMac ? "Opt" : "Alt"
};

// Result: "Cmd+Z" on Mac, "Ctrl+Z" on Windows
```

**`formatShortcutKey()`**:

```typescript
const formatted = formatShortcutKey(shortcut.key);
// "Ctrl+Z" or "Cmd+Shift+E" or "F1"
```

## Keyboard Event Handling

### Global Keyboard Listener

**Location**: `src/components/layout/BaseLayout.tsx` or similar

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Check if event matches any shortcut
    for (const shortcut of SHORTCUTS) {
      if (matchesShortcut(event, shortcut.id)) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

### Scope-Aware Matching

**Shortcuts only work in appropriate context**:

```typescript
// Only matching-scoped shortcuts work on matching page
const isInMatchingScope = currentPage === "matching";
const isShortcutApplicable = shortcut.scope.includes("matching");

if (isInMatchingScope && isShortcutApplicable) {
  shortcut.action(); // Execute
}
```

### Event Prevention

**Prevent default browser behavior**:

```typescript
if (matchesShortcut(event, "general:search")) {
  event.preventDefault(); // Don't open browser search
  openAppSearch();
}
```

## Special Cases

### Form Input Handling

**Shortcuts disabled in input fields**:

```typescript
// Don't trigger shortcuts while typing in text input
if (event.target instanceof HTMLInputElement) {
  if (event.key !== "Escape") {
    return; // Let input handle it
  }
}
```

**Exception: Escape key**:

- Always close modal/clear search
- Even in input fields
- User expects this behavior

### Conflicting Shortcuts

**Browser shortcuts take precedence**:

- `F12` - Open DevTools (browser wins)
- `Ctrl+W` - Close tab (browser wins)
- `Ctrl+Shift+Delete` - Open settings (browser wins)

**App shortcuts override when possible**:

- `Ctrl+F` - Search in app (app prevents browser find)
- `Ctrl+S` - Sync (app wins if on sync page)

## Display to Users

### Help Panel

**`src/components/ShortcutsPanel.tsx`**:

```typescript
const ShortcutsPanel = () => {
  const categories = [
    ShortcutCategory.GENERAL,
    ShortcutCategory.NAVIGATION,
    ShortcutCategory.MATCHING,
    ShortcutCategory.SYNC
  ];

  return categories.map(category => (
    <ShortcutCategorySection
      category={category}
      shortcuts={getShortcutsByCategory(category)}
    />
  ));
};
```

**Display format**:

```text
┌─ General Shortcuts ──────────────────────┐
│ Ctrl+Z (Cmd+Z)     Undo                  │
│ Ctrl+Y (Cmd+Shift+Z) Redo                │
│ Ctrl+F (Cmd+F)     Search                │
└──────────────────────────────────────────┘

┌─ Matching Shortcuts ─────────────────────┐
│ Enter              Accept match          │
│ Delete             Reject match          │
│ Up / Down          Navigate              │
└──────────────────────────────────────────┘
```

### Tooltip on Hover

**Buttons can show shortcut**:

```typescript
<button
  onClick={handleAccept}
  title={`Accept match (${formatShortcutKey(MATCHING_SHORTCUTS[0].key)})`}
>
  Accept
</button>
// Shows: "Accept match (Enter)"
```

## Customization & Future Work

### Currently Not Implemented

- ❌ Remappable shortcuts (hardcoded)
- ❌ Shortcut conflicts detection
- ❌ Settings UI to change bindings
- ❌ Shortcut profiles/presets
- ❌ Export/import shortcut mappings

### Could Be Added

- ✅ Settings page with customizable shortcuts
- ✅ Conflict detection and warnings
- ✅ Platform-specific default sets
- ✅ Vim keybindings mode
- ✅ Game-like keybinding presets

## Integration with Components

### Button with Shortcut

```typescript
const AcceptButton = () => {
  const shortcut = getShortcutById("matching:accept");
  
  return (
    <button
      onClick={() => shortcut.action()}
      title={`${shortcut.description} (${formatShortcutKey(shortcut.key)})`}
      className="..."
    >
      Accept
    </button>
  );
};
```

### Navigation with Shortcuts

```typescript
// In router
NAVIGATION_ITEMS.map(item => ({
  ...item,
  shortcut: getShortcutById(`nav:${item.id}`),
  // Display shortcut in menu
}))
```

## Performance

### Optimization Strategies

**Index by ID**:

```typescript
const shortcutMap = new Map(
  SHORTCUTS.map(s => [s.id, s])
);

// O(1) lookup instead of O(n)
const shortcut = shortcutMap.get("matching:accept");
```

**Memoize scope check**:

```typescript
const getApplicableShortcuts = useMemo(() => {
  return SHORTCUTS.filter(s => 
    s.scope.includes(currentPage)
  );
}, [currentPage]);
```

## Best Practices

✅ **DO**:

- Use descriptive shortcut IDs
- Include platform variants (Ctrl vs Cmd)
- Prevent default browser behavior when needed
- Show shortcuts in UI hints
- Test across platforms

❌ **DON'T**:

- Use conflicting shortcuts
- Map shortcuts to rarely-used actions
- Hide shortcuts from users
- Use complex key combinations
- Forget about accessibility

## Testing Shortcuts

```typescript
describe("Shortcuts", () => {
  it("should trigger accept action on Enter", () => {
    const action = vi.fn();
    const shortcut = { key: { key: "Enter" }, action };
    
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    expect(matchesShortcut(event, shortcut.id)).toBe(true);
  });

  it("should not trigger in input field", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      target: input
    });
    
    // Handle appropriately
  });
});
```
