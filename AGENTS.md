# Kenmei to AniList - AI Coding Assistant Instructions

## 🚨 CRITICAL: Workflow

**ALWAYS follow this sequence**:

1. `mcp_oraios_serena_activate_project "KenmeiToAnilist"` - Activate project first
2. Explore with Serena tools (`get_symbols_overview`, `find_symbol`, `search_for_pattern`, `list_dir`)
3. Use `think_about_collected_information` after gathering context
4. Make precise edits
5. Use `think_about_task_adherence` before committing changes
6. Use `think_about_whether_you_are_done` to verify completion

**KEY**: Use Serena tools for discovery, not reading files unless necessary. Memories are for context only—NOT documentation summaries.

## 📚 Context7 Integration

**Always `use context7`** when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

## Serena Modes & Adaptive Behavior

**Default modes:** `["planning", "interactive", "editing"]`

Always assume the default modes are active to ensure modes are correctly set and you don't forget to change them.

Always use the `switch_modes` tool to adapt modes based on task complexity:

| Task Type               | Modes                                                         | When to Use                                          |
| ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| **Trivial fixes**       | `["one-shot", "editing"]`                                     | Skip planning overhead, make & verify immediately    |
| **Small edits**         | `["interactive", "editing"]`                                  | Still ask questions, skip detailed planning          |
| **Medium features**     | `["planning", "interactive", "editing"]`                      | Brief 3–6 item plan, explore, edit incrementally     |
| **Large/risky changes** | `["planning", "interactive", "editing"]` + extra verification | Thorough planning & verification at every checkpoint |

**Thinking Tools — Use at Relevant Checkpoints:**

- **`think_about_collected_information`** → After exploring code, verify context is sufficient before editing
- **`think_about_task_adherence`** → Before making changes, confirm the approach is still correct
- **`think_about_whether_you_are_done`** → After completing work, verify all requirements are met

_Use these thinking tools whenever applicable, not just for the largest changes._

## Serena Tools

### Exploration Tools (Code Discovery)

- **`get_symbols_overview`**: High-level view of top-level symbols in a file
- **`find_symbol`**: Locate specific symbol by name path with optional depth
- **`search_for_pattern`**: Regex search when you don't know exact symbol names
- **`list_dir`**: Understand project structure
- **`find_file`**: Search files by glob pattern

**Best Practice**: Always explore with these tools BEFORE reading files. Saves tokens and time.

## Memory Strategy

Use memories for context only:

- **Project patterns**: Recurring code patterns, conventions, architectural rules
- **Critical decisions**: Why certain choices were made, constraints to maintain
- **Essential workflows**: Complex multi-step processes that are hard to discover

**Do NOT write memories for**: Documentation summaries, code overviews, or API reference (use Serena tools instead).

**Critical Success Factors:**

- ✅ Always activate project before using Serena tools
- ✅ Use Serena tools for code exploration before reading files
- ✅ Switch modes based on task complexity
- ✅ Use serena thinking tools at relevant checkpoints
- ✅ Write memories only for essential context, not documentation summaries
