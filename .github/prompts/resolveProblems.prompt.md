---
agent: agent
name: resolveProblems
description: Resolve code quality, type, and lint issues from the Problems view systematically and verify fixes with comprehensive testing.
argument-hint: Optional - specific issue to fix, or leave empty to resolve all visible problems.
---

# Resolve Code Quality Issues

⚠️ **BLOCKING REQUIREMENT**: You MUST call `sonarqube_analyze_file` on all target file(s) and then call the VS Code tools `get_errors` or `problems` to retrieve actual error data BEFORE any analysis. Do NOT proceed without real error data from the tools.

You are tasked with resolving issues visible in the Problems view (including SonarQube, TypeScript, ESLint, and other linters) systematically and ensuring fixes are properly validated. You can work on single or multiple files (when multiple files are attached).

## Workflow

### 1. **CRITICAL: Get Actual Problems First**

- **DO NOT SKIP THIS STEP** - Always activate the project using `mcp_oraios_serena_activate_project`
- **Identify the problematic file(s)** - Use attached files if provided, otherwise ask user or check the Problems view in VS Code
- **Call `sonarqube_analyze_file` on EACH target file** to populate the Problems view with current issues
- **THEN call `get_errors` or `problems` tool** to retrieve and document all detected issues with line numbers, severity, and messages for each file
- You MUST have real error data before proceeding - never assume or infer problems from the description alone
- Document all issues found organized by file, with their line numbers, severity, message, and affected code
- Only after collecting and documenting actual errors should you proceed to the next steps

### 2. **Gather Additional Context**

- Read affected files to understand the code structure
- Use Serena tools (`find_symbol`, `get_symbols_overview`) for precise code location
- Analyze each file's context and relationships
- **Cognitive Complexity**: Functions with nested conditionals/loops exceeding threshold
- **Nested Ternaries**: Complex conditional expressions in JSX or logic
- **Type Issues**: Missing annotations, type mismatches, unsafe type casts
- **Security**: Hardcoded credentials, injection vulnerabilities, missing validation
- **Code Smells**: Duplicated code, overly long methods, unclear naming
- **Documentation**: Missing JSDoc, ambiguous comments
- **Unused Code**: Dead code, unused variables, unused imports

### 3. **Analyze Issues**

- Review the documented issues from step 1, grouped by file
- For each file, group issues by type
- **Cognitive Complexity**: Functions with nested conditionals/loops exceeding threshold
- **Nested Ternaries**: Complex conditional expressions in JSX or logic
- **Type Issues**: Missing annotations, type mismatches, unsafe type casts
- **Security**: Hardcoded credentials, injection vulnerabilities, missing validation
- **Code Smells**: Duplicated code, overly long methods, unclear naming
- **Documentation**: Missing JSDoc, ambiguous comments
- **Unused Code**: Dead code, unused variables, unused imports

### 4. **Plan Refactoring**

- Identify root causes, not symptoms
- Extract helper functions for complex logic
- Extract components for complex JSX rendering
- Use composition to reduce nesting depth
- Create utility functions for repeated patterns
- Plan changes that maintain 100% functional equivalence

### 5. **Implement Fixes Systematically**

- Process each file's issues in logical order, prioritizing related changes
- Extract helper functions **before** the main component/function they serve
- Helper functions should be module-level or at the top of scope
- Use clear, descriptive names that explain purpose
- Apply multiple fixes in parallel using `multi_replace_string_in_file` when fixing issues across files or within the same file
- Ensure all readonly/type contracts are enforced
- Add JSDoc comments to extracted functions

### 6. **Maintain Behavioral Equivalence**

- Ensure refactored code produces identical behavior
- Preserve all error handling paths
- Maintain state management and callbacks
- Keep cancellation/abort signal handling intact
- Test edge cases mentally before applying changes

### 7. **Verify Secondary Issues**

- **Call `sonarqube_analyze_file` on modified files** to check for any new issues introduced
- **Call `get_errors` or `problems` tool** to verify what issues remain after your changes
- Identify any type mismatches that were introduced by your changes
- Add proper type annotations and type guards where needed
- Ensure parameter types match function signatures
- Add missing imports if required

### 8. **Verify Resolution**

- **Re-run `sonarqube_analyze_file` on ALL modified files** and then **call `get_errors` or `problems` tool** to confirm all issues are resolved across all files
- Document which problems were resolved for each file and verify they no longer appear in the error list
- Execute `npm run typecheck` to verify TypeScript compilation passes
- Execute `npm run lint` to ensure linting standards are met
- Verify no new issues were introduced in any file
- Check all related code paths still function correctly

## Resolution Patterns by Issue Type

| Issue Type               | Pattern                                 | Example                                         |
| ------------------------ | --------------------------------------- | ----------------------------------------------- |
| **Cognitive Complexity** | Extract helper functions and components | `extractHelperFunction()`, `HelperComponent`    |
| **Nested Ternaries**     | Use named functions returning strings   | `formatButtonLabel()` instead of inline ternary |
| **Complex JSX**          | Extract into child components           | `BackupListContent`, `BackupList`               |
| **Type Mismatches**      | Add type annotations and guards         | `readonly` properties, union types              |
| **Duplicated Code**      | Extract utility function                | `parseBackupCount()`, `clampValue()`            |
| **Long Methods**         | Break into smaller functions            | Each function handles one concern               |
| **Magic Numbers**        | Use named constants                     | `MIN_BACKUPS = 1`, `MAX_BACKUPS = 50`           |
| **Missing JSDoc**        | Add clear documentation                 | `@param`, `@returns` with descriptions          |
| **Security Issues**      | Add validation/sanitization             | Input validation before processing              |
| **Dead Code**            | Remove or repurpose                     | Delete unused variables/imports                 |

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

- [ ] `sonarqube_analyze_file` and `get_errors`/`problems` tool confirm all issues are resolved
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] Code maintains 100% functional equivalence
- [ ] No new issues introduced by changes
- [ ] Type safety is enforced throughout
- [ ] Helper functions have clear names and documentation
- [ ] Related code paths tested mentally for correctness
