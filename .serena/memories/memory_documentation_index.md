# Project Memory Documentation Index

## Overview

This memory serves as a comprehensive index of all Serena memories available for the KenmeiToAnilist project. Each memory documents a specific architectural component, system, or feature with detailed implementation patterns, best practices, and integration points.

## Memory Categories

### Core Architecture & Patterns (5 memories)

1. **architecture_and_decisions** ✅
   - Three-layer storage system (cache → localStorage → Electron Store)
   - React Context architecture (Auth, Debug, Theme, RateLimit)
   - IPC communication and context bridge pattern
   - Routing architecture with TanStack Router
   - UI component architecture (shadcn/ui + Tailwind CSS 4.1)
   - Matching algorithm and scoring system overview
   - Covers: Core decisions that define app structure

2. **ipc_and_context_bridge_patterns** ✅
   - Five exposed contexts: Window, Theme, Auth, Store, API
   - Context bridge security model
   - Handler registration and organization
   - OAuth flow with HTTP server pattern
   - Rate limiting and batching strategy
   - IPC debugging capabilities
   - Covers: Safe inter-process communication patterns

3. **critical_patterns_and_anti_patterns** ✅
   - Storage operation patterns (ALWAYS use storage abstraction)
   - IPC communication rules (NEVER access ipcRenderer directly)
   - Cache management with bypassCache flag
   - Error handling with createError()
   - Type safety requirements
   - Custom matching rules with regex validation
   - Metadata field selection for rules
   - Covers: MUST-FOLLOW patterns and things to avoid

4. **error_handling_guide** ✅
   - ErrorType enum and structured error creation
   - Error boundaries for React components
   - Sentry integration for production tracking
   - Structured logging with MODULE_TAGS
   - Recovery actions for user-facing errors
   - Covers: Comprehensive error management strategy

5. **logging_and_debugging_architecture** ✅
   - Module-tagged console logging with emoji indicators
   - LogCollector for capturing logs in memory
   - Log redaction for sensitive data
   - Debug mode log viewer with filtering
   - Sentry integration for error tracking
   - Performance logging with group context
   - Covers: Logging and debugging infrastructure

### Data Management & Processing (4 memories)

1. **backup_system_and_persistence** ✅
   - Automated backup scheduling with rotation
   - Backup file locations (platform-specific)
   - Atomic backup operations with mutex protection
   - Recovery process and history tracking
   - Covers: Complete backup and restore system

2. **kenmei_data_import_system** ✅
   - CSV file format and parsing with validation
   - Data enrichment and status mapping (Kenmei → AniList)
   - Batch processing with progress tracking
   - Import workflow and error handling
   - Merge and deduplication logic
   - Covers: End-to-end data import pipeline

3. **web_workers_system** ✅
   - Worker pool architecture for CPU-intensive operations
   - Operation types (CSV, matching, statistics, filtering, etc.)
   - Cancellation token pattern for long operations
   - Progress tracking and error handling
   - Task queuing and worker lifecycle
   - Covers: Off-thread computation infrastructure

### Matching & Scoring (3 memories)

1. **matching_and_scoring_system** ✅
   - Pipeline: Search → Filter → Score → Rank
   - Similarity algorithms (7 methods with caching)
   - Confidence mapping and auto-match threshold
   - System filters and custom rule system
   - Source fallback (ComicK, MangaDex)
   - Categorization: Cached vs Known vs Uncached
   - Covers: Complete matching pipeline with algorithms

2. **manga_sources_and_fallback_system** ✅
   - MangaSourceRegistry for multi-source searches
   - ComicK and MangaDex as fallbacks
   - Result merging and deduplication
   - Source-specific conversion to AniList format
   - Per-source caching and rate limiting
   - Covers: Multi-source manga search architecture

### Synchronization & Updates (2 memories)

1. **sync_service_and_incremental_updates** ✅
   - Batch processing with rate limit (60 req/min)
   - Three-step incremental updates (progress → status → notes)
   - EntryProcessingContext for tracking
   - Failed operation queue with retry logic
   - Progress tracking and sync reports
   - Resume capability after interruption
   - Covers: Robust sync to AniList with recovery

2. **update_version_system** ✅
   - Version management from package.json
   - Update checking via GitHub releases
   - Update notification with dismissal tracking
   - Manual installation process
   - Version comparison and release notes
   - Pre-release and beta handling
   - Covers: Application versioning and updates

### User Interaction & Automation (4 memories)

1. **keyboard_shortcuts_system** ✅
   - Shortcut categories (General, Nav, Matching, Sync, Debug)
   - Context-aware scope matching
   - Platform-specific key formatting (Ctrl vs Cmd)
   - Global keyboard listener pattern
   - Special handling for form inputs
   - Help panel and tooltip integration
   - Covers: Complete keyboard shortcut system

2. **undo_redo_system** ✅
   - Command pattern with 7 command types
   - UndoRedoManager with stacks
   - Command metadata for history tracking
   - Batch operations with rollback
   - Integration with matching system
   - Stack limits and atomicity
   - Covers: Full undo/redo infrastructure

3. **statistics_analytics_system** ✅
   - Metrics: Match progress, reading stats, trends
   - 10+ chart types for visualization
   - Time range and multi-filter support
   - Worker-based calculation for performance
   - Data export (CSV/JSON)
   - Drill-down modal for details
   - Covers: Comprehensive analytics and reporting

### Supporting Systems (3 memories)

1. **react_hooks_and_patterns** ✅
   - Custom hooks (useAuth, useSynchronization, useTimeEstimate, etc.)
   - Batch selection pattern with Set
   - Dependency array rules (React Compiler)
   - Cleanup in useEffect
   - useCallback for props
   - useState with objects
   - Covers: React-specific patterns and hooks

2. **sonarqube_complexity_patterns** ✅
   - Cognitive complexity refactoring
   - Nested loops → extract inner function
   - Conditionals → extract validators
   - Complex regex → multi-step validation
   - Testing and SonarQube compliance
   - Covers: Code quality and complexity management

3. **common_gotchas_and_solutions** ✅
   - IPC and communication issues
   - React Compiler and hooks issues
   - Cache and storage issues
   - Performance issues
   - API and authentication issues
   - Type safety issues
   - Debug mode issues
   - Covers: Common problems and solutions

## How to Use This Index

### For Developers

1. **Starting with codebase**: Read `architecture_and_decisions`
2. **Working on matching**: Read `matching_and_scoring_system`
3. **Adding features**: Check `critical_patterns_and_anti_patterns`
4. **Debugging issues**: Read `common_gotchas_and_solutions`
5. **Handling errors**: Read `error_handling_guide`

### By Task Type

**Implementing New Feature**:

1. Critical patterns - know what to avoid
2. Relevant memory (matching, sync, import, etc.)
3. Common gotchas - anticipate issues
4. Error handling guide - plan error cases

**Debugging**:

1. Common gotchas
2. Logging architecture (how to enable debug)
3. IPC patterns (if communication issue)
4. Error handling (if error occurred)

**Optimizing Performance**:

1. Web workers system (offload to threads)
2. SonarQube patterns (reduce complexity)
3. Storage patterns (cache efficiently)
4. Statistics system (see calculation approach)

**Understanding Architecture**:

1. Architecture and decisions (overview)
2. IPC patterns (communication layer)
3. Storage (persistence layer)
4. React hooks (state management)
5. Error handling (resilience)

## Documentation Quality Checklist

Each memory should contain:

- ✅ Clear overview section
- ✅ Architecture explanation with diagrams/text
- ✅ Code examples where applicable
- ✅ Integration points with other systems
- ✅ Error handling strategies
- ✅ Performance characteristics
- ✅ Limitations and constraints
- ✅ Best practices (DO/DON'T sections)
- ✅ Future enhancement suggestions
- ✅ Testing/debugging guidance

## Maintenance Notes

### When Adding Code

1. Check if relevant memory exists
2. Update memory with new patterns if discovered
3. Document any changes to critical patterns
4. Note in memory if implementation differs

### When Refactoring

1. Update relevant memory if structure changes
2. Add new patterns if discovered
3. Document why refactoring was needed
4. Update anti-patterns section if applicable

## Quick Reference: When to Use Each Memory

| Task               | Memory                               | Why                      |
| ------------------ | ------------------------------------ | ------------------------ |
| Adding new feature | critical_patterns                    | Know the rules           |
| Debugging sync     | sync_service_and_incremental_updates | Understand flow          |
| Improving matching | matching_and_scoring_system          | Know algorithms          |
| Fixing UI issue    | react_hooks_and_patterns             | Understand React         |
| Adding logging     | logging_and_debugging_architecture   | Know patterns            |
| Handling errors    | error_handling_guide                 | Proper error handling    |
| IPC problem        | ipc_and_context_bridge_patterns      | Understand communication |
| Storage issue      | architecture_and_decisions           | Know three-layer system  |
| Performance        | web_workers_system                   | Offload computation      |
| Stuck/confused     | common_gotchas_and_solutions         | Find solution            |

## Contact & Questions

If a memory is unclear or outdated:

1. Check code implementation
2. Update memory if discovery made
3. Add pattern to critical_patterns if it's a rule
4. Document solution if it's a gotcha

All memories should be maintainable and kept in sync with actual codebase implementation.
