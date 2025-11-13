---
name: resolveProblems
description: Resolve code quality, type, and lint issues from the Problems view systematically and verify fixes with comprehensive testing.
argument-hint: Optional - specific issue to fix, or leave empty to resolve all visible problems.
---

# Resolve Code Quality Issues

You are tasked with resolving issues visible in the Problems view (including SonarQube, TypeScript, ESLint, and other linters) systematically and ensuring fixes are properly validated.

## Workflow

### 1. **Gather Context**
   - Activate the project using `mcp_oraios_serena_activate_project`
   - Check the Problems view using the built-in `get_errors` tool to identify all issues of the given file or files
   - Read affected files to understand the code structure
   - Use Serena tools (`find_symbol`, `get_symbols_overview`) for precise code location

### 2. **Analyze Issues**
   - **Cognitive Complexity**: Functions with nested conditionals/loops exceeding threshold
   - **Nested Ternaries**: Complex conditional expressions in JSX or logic
   - **Type Issues**: Missing annotations, type mismatches, unsafe type casts
   - **Security**: Hardcoded credentials, injection vulnerabilities, missing validation
   - **Code Smells**: Duplicated code, overly long methods, unclear naming
   - **Documentation**: Missing JSDoc, ambiguous comments
   - **Unused Code**: Dead code, unused variables, unused imports

### 3. **Plan Refactoring**
   - Identify root causes, not symptoms
   - Extract helper functions for complex logic
   - Extract components for complex JSX rendering
   - Use composition to reduce nesting depth
   - Create utility functions for repeated patterns
   - Plan changes that maintain 100% functional equivalence

### 4. **Implement Fixes Systematically**
   - Extract helper functions **before** the main component/function they serve
   - Helper functions should be module-level or at the top of scope
   - Use clear, descriptive names that explain purpose
   - Apply multiple fixes in parallel using `multi_replace_string_in_file` when possible
   - Ensure all readonly/type contracts are enforced
   - Add JSDoc comments to extracted functions

### 5. **Maintain Behavioral Equivalence**
   - Ensure refactored code produces identical behavior
   - Preserve all error handling paths
   - Maintain state management and callbacks
   - Keep cancellation/abort signal handling intact
   - Test edge cases mentally before applying changes

### 6. **Fix Secondary Issues**
   - Run `get_errors` to identify type mismatches introduced
   - Add proper type annotations and type guards
   - Ensure parameter types match function signatures
   - Add missing imports

### 7. **Verify Resolution**
   - Run `get_errors` to confirm all issues are resolved
   - Execute `npm run typecheck` to verify TypeScript compilation
   - Execute `npm run lint` to ensure linting standards are met
   - Verify no new issues were introduced
   - Check all related code paths still function correctly

## Resolution Patterns by Issue Type

| Issue Type | Pattern | Example |
|---|---|---|
| **Cognitive Complexity** | Extract helper functions and components | `extractHelperFunction()`, `HelperComponent` |
| **Nested Ternaries** | Use named functions returning strings | `formatButtonLabel()` instead of inline ternary |
| **Complex JSX** | Extract into child components | `BackupListContent`, `BackupList` |
| **Type Mismatches** | Add type annotations and guards | `readonly` properties, union types |
| **Duplicated Code** | Extract utility function | `parseBackupCount()`, `clampValue()` |
| **Long Methods** | Break into smaller functions | Each function handles one concern |
| **Magic Numbers** | Use named constants | `MIN_BACKUPS = 1`, `MAX_BACKUPS = 50` |
| **Missing JSDoc** | Add clear documentation | `@param`, `@returns` with descriptions |
| **Security Issues** | Add validation/sanitization | Input validation before processing |
| **Dead Code** | Remove or repurpose | Delete unused variables/imports |

## Best Practices

✅ **DO:**
- Use semantic tools for code discovery before editing
- Apply changes in logical batches with `multi_replace_string_in_file`
- Test complex logic mentally before implementation
- Preserve all original functionality
- Add clear, concise documentation
- Follow the project's existing code style

❌ **DON'T:**
- Change behavior while refactoring
- Leave partially complete fixes
- Create new issues while fixing old ones
- Over-engineer solutions
- Create unnecessary files unless essential
- Commit without verification

## Verification Checklist

- [ ] All issues from `get_errors` are resolved
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] Code maintains 100% functional equivalence
- [ ] No new issues introduced
- [ ] Type safety is enforced throughout
- [ ] Helper functions have clear names and documentation
- [ ] Related code paths tested mentally for correctness
