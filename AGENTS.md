# Kenmei to AniList - AI Coding Assistant Instructions

> **Note**: This file complements memory documents created specifically for this project. Reference them during development for specific guidance on patterns, troubleshooting, and feature implementation.

## 🚨 CRITICAL: Tool Usage Priority & Workflow

**ALWAYS USE THIS WORKFLOW** - This is the most important context for working in this codebase:

```text
1. Check appropriate memory (type_definitions_and_interfaces, ipc_and_context_bridge_patterns, etc.)
2. Explore code with Serena tools (get_symbols_overview, find_symbol)
3. Make precise edits
4. Verify with SonarQube (analyze_file, list_potential_security_issues)
```

## Tools & Project Setup

### ⚡ Project Activation (MUST DO FIRST)

**Always activate the project before using Serena tools**:

```bash
mcp_oraios_serena_activate_project "KenmeiToAnilist"
```

### Available Serena Tools

Serena provides **semantic code exploration tools** (symbol-based, token-efficient). The project has access to these tools:

**Code Exploration & Navigation**:

- `activate_project` - Activate a project by name
- `get_symbols_overview` - Get overview of top-level symbols in a file
- `find_symbol` - Search for symbols (functions, classes, etc.) by name
- `find_referencing_symbols` - Find all references to a symbol
- `find_referencing_code_snippets` - Find code snippets where symbol is referenced
- `search_for_pattern` - Regex pattern search across the project
- `list_dir` - List files and directories (optionally recursive)

**Memory Management**:

- `check_onboarding_performed` - Check if onboarding was completed
- `list_memories` - List all project memories
- `read_memory` - Read a specific memory document
- `write_memory` - Create or update a memory document
- `delete_memory` - Delete a memory file
- `get_current_config` - View current project configuration

**File Operations**:

- `read_file` - Read file contents within project
- `create_text_file` - Create/overwrite a file in project directory
- `restart_language_server` - Restart language server if needed

**Other Utilities**:

- `onboarding` - Perform project onboarding
- `execute_shell_command` - Execute shell commands
- `summarize_changes` - Summarize changes made to codebase
- `prepare_for_new_conversation` - Prepare for new conversation
- `initial_instructions` - Get initial project instructions
- `remove_project` - Remove project from Serena configuration
- `switch_modes` - Activate modes by name
- `think_about_collected_information` - Thinking tool for analysis
- `think_about_task_adherence` - Thinking tool for task tracking
- `think_about_whether_you_are_done` - Thinking tool for completion

**Disabled Tools** (currently unavailable in `.serena/project.yml`):

- `insert_after_symbol` - Insert code after symbol
- `insert_at_line` - Insert code at specific line
- `insert_before_symbol` - Insert code before symbol
- `replace_symbol_body` - Replace entire symbol definition
- `replace_lines` - Replace range of lines
- `delete_lines` - Delete range of lines

### SonarQube Tools

Use for code quality analysis:

- **`sonarqube_analyze_file`** - Analyze file for issues
- **`sonarqube_list_potential_security_issues`** - Find security hotspots

## Project Overview

Electron desktop app (React 19 + TypeScript) for migrating manga libraries from Kenmei to AniList. Built with secure main/renderer process architecture, three-layer storage system, GraphQL API integration, and React Compiler optimization.

**Key Technologies**: Electron 38, React 19, TanStack Router, TailwindCSS 4.1, shadcn/ui (Radix UI), Vite 7, Electron Forge

## Quick Start by Task

**Need to...**

- **Add a new UI page?** → Start with `feature_development_checklist` memory
- **Debug IPC communication?** → Check `ipc_and_context_bridge_patterns` + `common_gotchas_and_solutions`
- **Understand data flow?** → See `type_definitions_and_interfaces` and `architecture_and_decisions`
- **Implement custom hook?** → Reference `react_hooks_and_patterns`
- **Reduce code complexity?** → Use `sonarqube_complexity_patterns`
- **Fix cache/storage issue?** → Check `common_gotchas_and_solutions` first
- **Add new API integration?** → See `critical_patterns_and_anti_patterns` and `architecture_and_decisions`

## Essential Reference Documents

- `docs/guides/ARCHITECTURE.md` - Complete architecture overview (774 lines)
- `docs/guides/STORAGE_IMPLEMENTATION.md` - Storage system details
- `docs/guides/API_REFERENCE.md` - AniList GraphQL API integration
- `documentation/` - Generated TypeDoc API documentation

## Architecture Patterns (See Memories for Details)

- **`architecture_and_decisions`** - Complete system design, storage layers, contexts, routing
- **`ipc_and_context_bridge_patterns`** - IPC architecture and exposed contexts
- **`type_definitions_and_interfaces`** - TypeScript types and interfaces across the codebase

Key files to reference:

- `docs/guides/ARCHITECTURE.md` - Complete architecture overview
- `docs/guides/STORAGE_IMPLEMENTATION.md` - Storage system details
- `src/helpers/ipc/context-exposer.ts` - Context bridge implementation

## Development Workflow

### Commands

```bash
npm start              # Dev with hot reload
npm run build          # Production build
npm run lint           # ESLint with React Compiler
npm run format:write   # Prettier formatting
npm run docs           # Generate TypeDoc documentation
```

### Key Structure

Main code lives in `src/` with organized by feature: components, contexts, hooks, pages, routes, types, utils. API calls in `src/api/`, IPC handlers in `src/helpers/ipc/`.

**Styling**: TailwindCSS 4.1 with `@tailwindcss/vite` + shadcn/ui components (Radix UI)

**Routing**: TanStack Router with memory history (no URLs in Electron)

**Build**: Electron Forge with Vite for main/preload/renderer processes

## Critical Patterns to Follow

### 0. Workflow (MUST FOLLOW)

**Activate project** → **Explore with Serena** → **Make edits** → **Verify with SonarQube**

Use Serena tools (`get_symbols_overview`, `find_symbol`, `search_for_pattern`) BEFORE reading entire files.

### 1. Storage Operations

**NEVER** access localStorage or electron-store directly. Use `src/utils/storage.ts` abstraction:

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";
storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(data));
const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);
```

### 2. IPC Communication

**Security violation** to use `ipcRenderer` in renderer. Use exposed context APIs:

```typescript
// ✅ Correct
await globalThis.electronStore.setItem(key, value);
const token = await globalThis.electronAuth.getAccessToken(code);

// ❌ Wrong - security violation
ipcRenderer.invoke("store:set", key, value);
```

### 3. Error Handling

Use `createError()` from `src/utils/errorHandling.ts` for consistent error objects:

```typescript
import { createError, ErrorType } from "@/utils/errorHandling";
throw createError(ErrorType.NETWORK, "Failed to fetch", error, "NETWORK_UNAVAILABLE");
```

## Memory-Driven Development

Each memory document is designed for specific development tasks:

### When Implementing Features

Use the **`feature_development_checklist`** memory for step-by-step guidance:

- Adding new UI pages
- Creating custom hooks
- Adding IPC handlers
- Managing storage keys
- Creating API queries

### When Debugging

Check **`common_gotchas_and_solutions`** for:

- IPC communication errors ("reply was never sent")
- React Compiler hook violations
- Cache staling issues
- Rate limit hits
- Authentication timeouts

### When Understanding Code

Reference appropriate memory:

- **Types & interfaces** → `type_definitions_and_interfaces`
- **Architecture systems** → `architecture_and_decisions`
- **IPC patterns** → `ipc_and_context_bridge_patterns`
- **React patterns** → `react_hooks_and_patterns`

### When Improving Code Quality

Use **`sonarqube_complexity_patterns`** for:

- Refactoring high complexity functions
- Reducing cognitive complexity
- Breaking down nested loops and conditionals
- Simplifying complex regex patterns

## Common Pitfalls

1. **Storage Layer Confusion**: Don't mix direct localStorage with storage abstraction
2. **IPC Security**: Never expose Node.js APIs to renderer without context bridge
3. **Cache Invalidation**: Increment `CURRENT_CACHE_VERSION` when data structures change
4. **Rate Limiting**: AniList enforces 60 req/min - batch operations must respect this
5. **React Compiler**: Breaking rules of hooks will cause ESLint errors (can't disable)

## When Making Changes

1. **New IPC Operations**: Add handler in `src/helpers/ipc/{domain}/`, expose in context, register in listeners
2. **New Storage Keys**: Add to `STORAGE_KEYS` constant, update cache version if structure changes
3. **New UI Components**: Use shadcn/ui pattern, place in `src/components/ui/`, import via `@/components/ui/*`
4. **New API Queries**: Define in `src/api/anilist/queries.ts`, add types to `src/api/anilist/types.ts`
5. **New Routes**: Create in `src/routes/`, export from `routes.tsx`, add to route tree

## Summary: Optimal Development Workflow

**The best way to work efficiently on this codebase:**

1. **Activate project first**: `mcp_oraios_serena_activate_project "KenmeiToAnilist"`
2. **Check appropriate memory**: Use task-based quick start above
3. **Explore with Serena**: Use `get_symbols_overview` and `find_symbol` before reading files
4. **Make targeted edits**: Use file editing tools for precision
5. **Verify with SonarQube**: Check for issues after changes
6. **Follow patterns**: Reference this file and docs/guides/

**Key Resources:**

- **Memories**: Specialized documents for specific tasks (listed in Quick Start)
- **AGENTS.md**: This file - tool usage, patterns, workflow
- **docs/guides/**: ARCHITECTURE.md, STORAGE_IMPLEMENTATION.md, API_REFERENCE.md
- **TypeDoc**: Generated API documentation in `documentation/`

**Critical Success Factors:**

- ✅ Always activate project before using Serena tools
- ✅ Always use storage abstraction (never direct localStorage)
- ✅ Never use ipcRenderer directly (use exposed contexts)
- ✅ Check rate limits before bulk API operations
- ✅ Follow rules of hooks (React Compiler enforces)
- ✅ Use Serena tools for exploration before reading files
