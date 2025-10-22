/**
 * Undo/Redo System for Match Operations
 *
 * Implements a command pattern-based undo/redo system that tracks and manages
 * all match operations (accept, reject, select alternative, etc.).
 *
 * @module utils/undoRedo
 */

import type { MangaMatchResult } from "@/api/anilist/types";

/**
 * Command types that can be undone/redone
 */
export enum CommandType {
  ACCEPT_MATCH = "accept_match",
  REJECT_MATCH = "reject_match",
  SELECT_ALTERNATIVE = "select_alternative",
  RESET_TO_PENDING = "reset_to_pending",
  SELECT_SEARCH_MATCH = "select_search_match",
  BATCH_OPERATION = "batch_operation",
}

/**
 * Metadata about a command for user feedback and debugging
 */
export interface CommandMetadata {
  type: CommandType;
  timestamp: number;
  affectedTitles: string[];
  description: string;
}

/**
 * Base interface for all commands
 */
export interface Command {
  execute(): void;
  undo(): void;
  getDescription(): string;
  getMetadata(): CommandMetadata;
}

/**
 * Callback function signature for executing state updates
 */
type OnExecuteCallback = (state: MangaMatchResult) => void;

/**
 * Abstract base class for all match operation commands
 *
 * Stores the minimal diff required to undo/redo: the affected match index
 * and the before/after states of that match.
 *
 * @example
 * const command = new AcceptMatchCommand(
 *   matchIndex,
 *   beforeState,
 *   afterState,
 *   (state) => setMatchResults(prev => updateMatch(prev, matchIndex, state)),
 *   "User accepted AI suggestion"
 * );
 * undoRedoManager.executeCommand(command);
 */
abstract class BaseCommand implements Command {
  protected metadata: CommandMetadata;

  constructor(
    protected matchIndex: number,
    protected beforeState: MangaMatchResult,
    protected afterState: MangaMatchResult,
    protected onExecute: OnExecuteCallback,
    type: CommandType,
    description: string,
  ) {
    this.metadata = {
      type,
      timestamp: Date.now(),
      affectedTitles: [beforeState.kenmeiManga.title],
      description,
    };
  }

  /**
   * Execute the command (apply "after" state)
   */
  execute(): void {
    this.onExecute(this.afterState);
  }

  /**
   * Undo the command (restore "before" state)
   */
  undo(): void {
    this.onExecute(this.beforeState);
  }

  /**
   * Get user-friendly description of what this command does
   */
  getDescription(): string {
    return this.metadata.description;
  }

  /**
   * Get metadata about this command
   */
  getMetadata(): CommandMetadata {
    return this.metadata;
  }
}

/**
 * Command for accepting a match suggestion
 */
export class AcceptMatchCommand extends BaseCommand {
  constructor(
    matchIndex: number,
    beforeState: MangaMatchResult,
    afterState: MangaMatchResult,
    onExecute: OnExecuteCallback,
  ) {
    super(
      matchIndex,
      beforeState,
      afterState,
      onExecute,
      CommandType.ACCEPT_MATCH,
      `Accept match for "${beforeState.kenmeiManga.title}"`,
    );
  }
}

/**
 * Command for rejecting/skipping a match
 */
export class RejectMatchCommand extends BaseCommand {
  constructor(
    matchIndex: number,
    beforeState: MangaMatchResult,
    afterState: MangaMatchResult,
    onExecute: OnExecuteCallback,
  ) {
    super(
      matchIndex,
      beforeState,
      afterState,
      onExecute,
      CommandType.REJECT_MATCH,
      `Reject match for "${beforeState.kenmeiManga.title}"`,
    );
  }
}

/**
 * Command for selecting an alternative match from suggestions
 */
export class SelectAlternativeCommand extends BaseCommand {
  constructor(
    matchIndex: number,
    beforeState: MangaMatchResult,
    afterState: MangaMatchResult,
    onExecute: OnExecuteCallback,
  ) {
    super(
      matchIndex,
      beforeState,
      afterState,
      onExecute,
      CommandType.SELECT_ALTERNATIVE,
      `Select alternative match for "${beforeState.kenmeiManga.title}"`,
    );
  }
}

/**
 * Command for resetting a match back to pending status
 */
export class ResetToPendingCommand extends BaseCommand {
  constructor(
    matchIndex: number,
    beforeState: MangaMatchResult,
    afterState: MangaMatchResult,
    onExecute: OnExecuteCallback,
  ) {
    super(
      matchIndex,
      beforeState,
      afterState,
      onExecute,
      CommandType.RESET_TO_PENDING,
      `Reset "${beforeState.kenmeiManga.title}" to pending`,
    );
  }
}

/**
 * Command for selecting a result from manual search
 */
export class SelectSearchMatchCommand extends BaseCommand {
  constructor(
    matchIndex: number,
    beforeState: MangaMatchResult,
    afterState: MangaMatchResult,
    onExecute: OnExecuteCallback,
  ) {
    super(
      matchIndex,
      beforeState,
      afterState,
      onExecute,
      CommandType.SELECT_SEARCH_MATCH,
      `Select manual search result for "${beforeState.kenmeiManga.title}"`,
    );
  }
}

/**
 * Composite command that groups multiple commands into a single undo/redo unit
 *
 * Useful for batch operations where multiple matches are modified together.
 * When undone/redone, all grouped commands are processed together.
 */
export class BatchCommand implements Command {
  private readonly metadata: CommandMetadata;

  constructor(
    private readonly commands: Command[],
    description: string = "Batch operation",
  ) {
    const allTitles = commands.flatMap(
      (cmd) => cmd.getMetadata().affectedTitles,
    );
    this.metadata = {
      type: CommandType.BATCH_OPERATION,
      timestamp: Date.now(),
      affectedTitles: allTitles,
      description: `${description} (${commands.length} items)`,
    };
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order to maintain consistency
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  getDescription(): string {
    return this.metadata.description;
  }

  getMetadata(): CommandMetadata {
    return this.metadata;
  }
}

/**
 * Manages undo/redo history for match operations
 *
 * Maintains two stacks: undo stack and redo stack. When a command is executed,
 * it's pushed to the undo stack and the redo stack is cleared. Commands can be
 * undone/redone using the public methods.
 *
 * @example
 * const manager = new UndoRedoManager(50); // Keep last 50 actions
 * const command = new AcceptMatchCommand(...);
 * manager.executeCommand(command);
 *
 * if (manager.canUndo()) {
 *   const metadata = manager.undo();
 *   console.log(`Undone: ${metadata.description}`);
 * }
 */
export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private isEnabled: boolean = true;

  /**
   * Create a new undo/redo manager
   * @param maxHistorySize Maximum number of commands to keep in history (default: 50)
   */
  constructor(private readonly maxHistorySize: number = 50) {}

  /**
   * Execute a command and add it to undo history
   *
   * Calling this method will:
   * 1. Execute the command
   * 2. Push it to the undo stack
   * 3. Clear the redo stack (since we've made a new action)
   * 4. Maintain history size by removing oldest entries
   *
   * @param command The command to execute
   */
  executeCommand(command: Command): void {
    if (!this.isEnabled) return;

    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack when new action is performed

    // Maintain max history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last command
   *
   * @returns Metadata about the undone command, or null if nothing to undo
   */
  undo(): CommandMetadata | null {
    if (this.undoStack.length === 0) return null;

    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);

    return command.getMetadata();
  }

  /**
   * Redo the last undone command
   *
   * @returns Metadata about the redone command, or null if nothing to redo
   */
  redo(): CommandMetadata | null {
    if (this.redoStack.length === 0) return null;

    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);

    return command.getMetadata();
  }

  /**
   * Check if there are commands available to undo
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if there are commands available to redo
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get a description of what will be undone (for UI display)
   */
  getUndoDescription(): string | null {
    return this.undoStack.at(-1)?.getDescription() ?? null;
  }

  /**
  /**
   * Get a description of what will be redone (for UI display)
   */
  getRedoDescription(): string | null {
    return this.redoStack.at(-1)?.getDescription() ?? null;
  }
  /**
   * Clear all undo and redo history
   *
   * Use this when operations occur that invalidate the history,
   * such as rematch operations that clear the cache.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Temporarily enable or disable command recording
   *
   * When disabled, executeCommand() becomes a no-op. This is useful
   * during operations like initial data loading where we don't want
   * to record intermediate states.
   *
   * @param enabled Whether to enable or disable the manager
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get information about current history size
   */
  getHistorySize(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    };
  }
}
