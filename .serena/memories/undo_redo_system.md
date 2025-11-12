# Undo/Redo System Architecture

## Overview

The application implements a sophisticated command pattern-based undo/redo system that supports complex operations like batch actions, match modifications, and state resets. All operations are fully reversible and tracked with metadata for user feedback.

## Core Architecture

**Location**: `src/utils/undoRedo.ts`

### Command Hierarchy

```typescript
interface Command {
  type: CommandType;
  execute(): Promise<void>;
  undo(): Promise<void>;
  metadata(): CommandMetadata;
}

abstract class BaseCommand implements Command {
  // Abstract base for all commands
  // Provides common structure and lifecycle
}
```

### Command Types

**`CommandType` Enum**:

```typescript
enum CommandType {
  ACCEPT_MATCH = "accept_match",           // User approves a match
  REJECT_MATCH = "reject_match",           // User rejects a match
  SELECT_ALTERNATIVE = "select_alternative", // User picks different candidate
  SELECT_SEARCH_MATCH = "select_search_match", // User manually searches & selects
  RESET_TO_PENDING = "reset_to_pending",   // Revert to unmatched state
  BULK_UPDATE = "bulk_update"               // Batch operation
}
```

## Command Implementations

### AcceptMatchCommand

**Purpose**: Record user accepting a matched manga entry

**Data**:

```typescript
class AcceptMatchCommand extends BaseCommand {
  private kenmeiMangaId: number;
  private selectedMatch: AniListManga;
  private previousMatch?: AniListManga; // For undo
  private previousStatus?: string; // For undo
}
```

**Execute**:

1. Mark manga as matched
2. Set selected match in storage
3. Update status if applicable
4. Record timestamp

**Undo**:

1. Restore to pending (unmatched)
2. Clear selected match
3. Restore previous status

### RejectMatchCommand

**Purpose**: Record user rejecting all search results

**Data**:

```typescript
class RejectMatchCommand extends BaseCommand {
  private kenmeiMangaId: number;
  private rejectionReason?: string;
  private previousMatch?: AniListManga; // For undo
}
```

**Execute**:

1. Clear matches
2. Mark as rejected
3. Store rejection reason

**Undo**:

1. Restore previous match if existed
2. Clear rejection marker

### SelectAlternativeCommand

**Purpose**: Record user choosing different candidate from search results

**Data**:

```typescript
class SelectAlternativeCommand extends BaseCommand {
  private kenmeiMangaId: number;
  private selectedCandidate: AniListManga;
  private previousMatch: AniListManga;
  private searchResults: AniListManga[];
}
```

**Execute**:

1. Replace selected match
2. Update in storage
3. Record new match

**Undo**:

1. Restore previous match
2. Keep search results intact

### SelectSearchMatchCommand

**Purpose**: Record user performing manual search and selecting result

**Data**:

```typescript
class SelectSearchMatchCommand extends BaseCommand {
  private kenmeiMangaId: number;
  private searchQuery: string;
  private selectedResult: AniListManga;
  private previousMatch?: AniListManga;
}
```

**Execute**:

1. Store search query
2. Set new match
3. Record selection

**Undo**:

1. Restore previous match
2. Clear search state

### ResetToPendingCommand

**Purpose**: Record user reverting matched entry back to pending

**Data**:

```typescript
class ResetToPendingCommand extends BaseCommand {
  private kenmeiMangaId: number;
  private previousMatch: AniListManga;
  private previousStatus: string;
}
```

**Execute**:

1. Remove match
2. Clear status
3. Mark as pending

**Undo**:

1. Restore match
2. Restore status

### BatchCommand

**Purpose**: Group multiple commands into single undo unit

**Data**:

```typescript
class BatchCommand extends BaseCommand {
  private commands: Command[];
  private batchLabel: string;
}
```

**Execute**:

1. Execute all commands in sequence
2. If any fails, undo already-executed commands
3. Return aggregate result

**Undo**:

1. Undo all commands in reverse order
2. Rollback partially executed batch

### BulkUpdateCommand

**Purpose**: Handle batch operations on multiple manga

**Data**:

```typescript
class BulkUpdateCommand extends BaseCommand {
  private kenmeiMangaIds: number[];
  private updateAction: "accept" | "reject" | "reset";
  private selectedMatches?: AniListManga[];
  private previousState: Map<number, CommandMetadata>;
}
```

**Execute**:

1. Apply action to all selected manga
2. Store previous state for undo
3. Record all changes

**Undo**:

1. Restore each manga to previous state
2. Reverse all changes atomically

## UndoRedoManager

### Main Class

**Location**: `src/utils/undoRedo.ts`

```typescript
class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private isExecuting = false;
  
  execute(command: Command): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  getHistory(): CommandMetadata[];
}
```

### State Management

**Stacks**:

```text
Undo Stack (LIFO)      Redo Stack (LIFO)
┌─────────────┐        ┌─────────────┐
│ Command 3   │        │             │
├─────────────┤        ├─────────────┤
│ Command 2   │        │             │
├─────────────┤        ├─────────────┤
│ Command 1   │        │             │
└─────────────┘        └─────────────┘
```

**Behavior**:

- **Execute**: Push to undo, clear redo
- **Undo**: Move from undo to redo
- **Redo**: Move from redo to undo
- **New command**: Clear entire redo stack

### Core Operations

**Execute Command**:

```typescript
const manager = getUndoRedoManager();
const command = new AcceptMatchCommand(mangaId, selectedMatch);
await manager.execute(command);
```

1. Call `command.execute()`
2. Push to undo stack
3. Clear redo stack
4. Emit change event
5. Update UI state

**Undo**:

```typescript
if (manager.canUndo()) {
  await manager.undo();
}
```

1. Pop from undo stack
2. Call `command.undo()`
3. Push to redo stack
4. Emit change event
5. Update UI state

**Redo**:

```typescript
if (manager.canRedo()) {
  await manager.redo();
}
```

1. Pop from redo stack
2. Call `command.execute()`
3. Push to undo stack
4. Emit change event
5. Update UI state

## CommandMetadata

### Tracking Information

```typescript
interface CommandMetadata {
  type: CommandType;
  timestamp: number; // ISO string
  description: string; // Human-readable: "Accepted 'Attack on Titan' → AniList #1234"
  kenmeiMangaId: number;
  resultingAniListId?: number;
  batchSize?: number; // For bulk operations
  affectedCount?: number; // Count of affected items
}
```

### Metadata Use Cases

**UI Display**:

- Undo button tooltip: "Undo: Accepted 'One Piece' → AniList #1234"
- Redo button tooltip: "Redo: Accepted 'Bleach' → AniList #5678"

**History Panel**:

- List all operations with timestamps
- Show what each command did
- Display affected manga count

**Analytics**:

- Track operation types
- Measure user workflow
- Identify problem areas

## Integration with Matching System

### Automatic Command Creation

**When user accepts match**:

```typescript
// In MatchingPage.tsx
const handleAcceptMatch = async (match: MangaMatch) => {
  const command = new AcceptMatchCommand(
    match.kenmeiManga.id,
    match.selectedMatch
  );
  
  await undoRedoManager.execute(command);
  // UI automatically updates via state management
};
```

**When user rejects match**:

```typescript
const handleRejectMatch = async (mangaId: number) => {
  const command = new RejectMatchCommand(mangaId);
  await undoRedoManager.execute(command);
};
```

### Batch Operations

**When user accepts multiple matches**:

```typescript
const handleBatchAccept = async (selectedIds: number[]) => {
  const commands = selectedIds.map(id => 
    new AcceptMatchCommand(id, matchMap.get(id))
  );
  
  const batchCmd = new BatchCommand(
    commands,
    `Accepted ${selectedIds.length} matches`
  );
  
  await undoRedoManager.execute(batchCmd);
};
```

## Keyboard Shortcuts

**Undo**: `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (macOS)
**Redo**: `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) or `Cmd+Shift+Z` (macOS)

Implemented in `src/utils/shortcuts.ts`

## Limitations & Constraints

### Non-Reversible Operations

**Operations that DON'T support undo**:

- Sync to AniList (one-way write)
- Delete backup files
- Export data (read-only)
- Import CSV (can reload previous version)

**Why**: These have external side effects that can't be easily reversed

### Stack Limits

**Maximum undo depth**: 100 commands

- Oldest commands automatically discarded when exceeded
- Prevents unbounded memory growth
- Trade-off: Can't undo very old operations

**Typical undo depth**: 20-30 commands

- Enough for typical user workflow
- 100 limit rarely reached in practice

### Atomicity

**All-or-nothing execution**:

- If command execute fails → state unchanged
- Batch commands: If one fails, rollback all executed ones
- No partial state

**Re-entrancy protection**:

```typescript
private isExecuting = false;

async execute(command: Command) {
  if (this.isExecuting) {
    throw new Error("Already executing command");
  }
  this.isExecuting = true;
  try {
    // Execute
  } finally {
    this.isExecuting = false;
  }
}
```

## Performance Characteristics

### Memory Usage

**Per command**: ~1KB (typical)

- Command metadata
- References to affected data
- Previous state snapshot

**With 100 undo limit**: ~100KB

- Negligible for typical systems
- Can expand for large batch operations

### Execution Speed

**Execute**: ~1-2ms (mostly storage writes)
**Undo/Redo**: ~1-2ms (same as execute)
**No noticeable delay to user**

## Advanced Features

### Selective Undo

Could be implemented (not currently):

```typescript
// Undo only specific command types
manager.undoSpecificType(CommandType.ACCEPT_MATCH);

// Undo to specific point
manager.undoToCommand(historyItem);
```

### Redo Limit Tracking

Current: Redo available only immediately after undo

Could be enhanced:

```typescript
// Track all commands, show full redo history
manager.getRedoHistory(): CommandMetadata[];
```

### Command Grouping

Current: BatchCommand groups related commands

Could be extended:

```typescript
// Group commands by user session or time window
manager.groupCommandsBy("time", 5000); // 5 second windows
```

## Testing & Debugging

### Debug Mode

In debug context, undo/redo operations are logged:

```typescript
logDebug(MODULE_TAGS.MATCHING, "Undo: Accepted match", { 
  commandType,
  affectedId
});
```

### Testing Undo/Redo

```typescript
describe("UndoRedoManager", () => {
  it("should execute and undo commands", async () => {
    const manager = new UndoRedoManager();
    const cmd = new AcceptMatchCommand(1, manga);
    
    await manager.execute(cmd);
    expect(manager.canUndo()).toBe(true);
    
    await manager.undo();
    // Verify state is reverted
  });
});
```

## Best Practices

✅ **DO**:

- Use appropriate command type for operation
- Include metadata for user feedback
- Handle async operations in execute/undo
- Test undo thoroughly

❌ **DON'T**:

- Mutate data directly outside command
- Skip error handling in commands
- Create commands with mutable references
- Assume redo available after other operations
