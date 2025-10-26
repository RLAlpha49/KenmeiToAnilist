# Feature Development Checklist

## Adding a New UI Page

### Step 1: Create Route & Page Component

- [ ] Create `src/pages/NewFeaturePage.tsx` component
- [ ] Define props interface for page
- [ ] Use `BaseLayout` wrapper for consistent structure
- [ ] Add to `src/routes/routes.tsx` as route definition
- [ ] Add to route tree in `src/routes/router.tsx`

### Step 2: Add Navigation

- [ ] Add link in navigation (`src/components/layout/Navigation.tsx`)
- [ ] Import route path from router
- [ ] Test navigation works

### Step 3: Implement UI Components

- [ ] Use shadcn/ui components from `src/components/ui/`
- [ ] Create feature-specific components in `src/components/feature-name/`
- [ ] Define prop interfaces for all components
- [ ] Use TailwindCSS for styling (auto-sorted by Prettier)
- [ ] Add CVA variants for component styling

### Step 4: Add Context/State if Needed

- [ ] Create context provider in `src/contexts/` if complex state
- [ ] OR use built-in contexts (AuthContext, DebugContext, etc.)
- [ ] Export custom hook `useFeatureName()` for easy access

### Step 5: Handle Data Access

- [ ] Use `storage` utility for localStorage/electron-store access
- [ ] Use exposed IPC contexts (`globalThis.electron*`) for Node.js operations
- [ ] Add error handling with `createError()`

### Step 6: Add Logging

- [ ] Use `console.debug("[FeatureName] message")` for module-tagged logs
- [ ] Include operation start, progress, and completion
- [ ] Include error details for debugging

### Step 7: Testing & Polish

- [ ] Run `npm run precommit` (format + lint)
- [ ] Test in dev mode: `npm start`
- [ ] Test on different screen sizes
- [ ] Test error states
- [ ] Verify accessibility (keyboard navigation, etc.)

---

## Adding New IPC Handler for Main Process Operation

### Step 1: Create Handler File

- [ ] Create `src/helpers/ipc/{domain}/{handler-name}.ts`
- [ ] Define channel name constant
- [ ] Export handler setup function

### Step 2: Implement Handler

```typescript
export function setupMyFeatureHandlers() {
  ipcMain.handle("myfeature:operation", async (_, params) => {
    try {
      console.debug("[MyFeature] Starting operation");
      const result = await performOperation(params);
      return { success: true, data: result };
    } catch (error) {
      console.error("[MyFeature] Operation failed:", error);
      return { success: false, error: String(error) };
    }
  });
}
```

### Step 3: Expose in Context Bridge

- [ ] Add to `src/helpers/ipc/context-exposer.ts`
- [ ] Expose in appropriate context object
- [ ] Test type inference works

### Step 4: Register Handler

- [ ] Import setup function in `src/helpers/ipc/listeners-register.ts`
- [ ] Call in main handler registration

### Step 5: Use in Renderer

```typescript
// In React component
const result = await globalThis.electronApi.operation(params);
if (!result.success) {
  // Handle error
}
```

---

## Adding New Storage Key

### Step 1: Define Storage Key

- [ ] Add to `STORAGE_KEYS` constant in `src/utils/storage.ts`
- [ ] Use UPPER_SNAKE_CASE naming
- [ ] Add JSDoc comment explaining purpose

### Step 2: Define Type

- [ ] Create interface for stored data in appropriate `src/types/*.ts`
- [ ] Add to barrel exports if in new file

### Step 3: Handle Migration

- [ ] If changing existing structure: increment `CURRENT_CACHE_VERSION`
- [ ] Old cache cleared on app restart after version bump
- [ ] No data loss - just cache invalidation

### Step 4: Use in Code

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";

// Save
storage.setItem(STORAGE_KEYS.NEW_KEY, JSON.stringify(data));

// Read
const data = storage.getItem(STORAGE_KEYS.NEW_KEY);
if (data) {
  const parsed = JSON.parse(data);
}

// Delete
storage.removeItem(STORAGE_KEYS.NEW_KEY);
```

---

## Adding New API Query

### Step 1: Define GraphQL Query

- [ ] Add to `src/api/anilist/queries.ts`
- [ ] Use query builder pattern
- [ ] Export as constant (e.g., `SEARCH_MANGA`)

### Step 2: Define Response Types

- [ ] Create interfaces in `src/api/anilist/types.ts`
- [ ] Include all response fields as typed properties
- [ ] Add JSDoc for complex fields

### Step 3: Create Client Function

- [ ] Add function in `src/api/anilist/client.ts`
- [ ] Implement caching if appropriate (30-min expiration for search)
- [ ] Add rate limit checking via `RateLimitContext`
- [ ] Handle errors with `createError()`

### Step 4: Handle Rate Limits

- [ ] Check remaining quota before making API call
- [ ] Implement retry logic for 429 responses
- [ ] Wait `retryAfter` seconds before retry
- [ ] Log rate limit status

### Step 5: Use in Services

- [ ] Call from matching service or sync service
- [ ] Handle errors gracefully
- [ ] Update progress context if batch operation

---

## Adding New Custom Hook

### Step 1: Create Hook File

- [ ] Create `src/hooks/use{FeatureName}.ts`
- [ ] Export default hook with `use` prefix
- [ ] Add JSDoc comment explaining purpose and usage

### Step 2: Implement Hook

```typescript
export default function useMyFeature() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    // Initialize or subscribe
    const unsubscribe = subscribeToSomething((value) => {
      setState(value);
    });

    // Cleanup
    return () => unsubscribe?.();
  }, []);

  return { state /* methods */ };
}
```

### Step 3: Handle Dependencies

- [ ] Import from contexts via `useAuth()`, `useDebug()`, etc.
- [ ] Use other custom hooks for composition
- [ ] Maintain proper dependency arrays

### Step 4: Error Handling

- [ ] Wrap async operations in try-catch
- [ ] Use `createError()` for consistency
- [ ] Propagate errors to caller or state

### Step 5: Test Usage

- [ ] Document expected props/context
- [ ] Add JSDoc @example if behavior is non-obvious
- [ ] Test hook in development

---

## Adding Type Definitions

### Step 1: Identify Scope

- [ ] API types → `src/types/api.ts`
- [ ] Auth types → `src/types/auth.ts`
- [ ] Matching types → `src/types/matching.ts`
- [ ] New domain → create new file

### Step 2: Define Interfaces

- [ ] Create interface with clear property names
- [ ] Add JSDoc for interface and each property
- [ ] Import related types as needed

### Step 3: Export & Document

- [ ] Export from file
- [ ] Add @source tag for TypeDoc generation
- [ ] Document usage location if non-obvious

### Step 4: Update Barrel Exports

- [ ] Add to `src/types/index.ts` if creating new file
- [ ] Import in type definition files that need it

---

## Common Patterns to Follow

### Error Handling Pattern

```typescript
try {
  const result = await operation();
  console.debug("[Module] Operation completed");
  return result;
} catch (error) {
  const err = createError(ErrorType.NETWORK, "Operation failed", error, "OPERATION_FAILED");
  console.error("[Module] Operation error:", err);
  throw err;
}
```

### Async State Pattern

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const execute = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    // operation
  } catch (err) {
    setError(String(err));
  } finally {
    setIsLoading(false);
  }
}, []);
```

### Context Hook Pattern

```typescript
export default function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used within MyProvider");
  }
  return context;
}
```

---

## Testing & Verification

Before committing:

1. [ ] Run `npm run precommit` - Format and lint
2. [ ] Run `npm start` - Start dev server
3. [ ] Test feature manually in app
4. [ ] Test error cases
5. [ ] Check console for any warnings/errors
6. [ ] Verify performance is acceptable
7. [ ] Use SonarQube if making complex changes

---

## Commit Messages and Versioning

### Writing Commits

- [ ] Use conventional commits format: `type(scope): subject`
- [ ] Choose appropriate type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- [ ] Use valid scope from commitlint.config.js
- [ ] Keep subject line under 100 characters
- [ ] Use lowercase for subject (no trailing period)
- [ ] Write in present tense: "add" not "added"
- [ ] Add body for complex changes (explain what and why)
- [ ] Reference issues in footer: `Fixes #123`, `Closes #456`
- [ ] Mark breaking changes: `BREAKING CHANGE:` in footer or `!` after type/scope

### Commit Validation

- [ ] Commit message passes commitlint validation
- [ ] Check `.husky/commit-msg.log` if validation fails
- [ ] Fix validation errors before force-pushing
- [ ] Ensure all commits in PR follow conventional format

### Before Release

- [ ] All commits since last release follow conventional commits
- [ ] Commit messages accurately describe changes
- [ ] Breaking changes are properly marked
- [ ] Issue references are included where applicable
- [ ] Run `npm run release` to generate changelog and bump version
- [ ] Review generated CHANGELOG.md entry
- [ ] Review package.json version bump
- [ ] Verify git tag was created

### Release Process

- [ ] Run appropriate release command:
  - `npm run release` (automatic version detection)
  - `npm run release:major` (breaking changes)
  - `npm run release:minor` (new features)
  - `npm run release:patch` (bug fixes)
- [ ] Review release commit: `git log -1`
- [ ] Review changelog: `cat CHANGELOG.md`
- [ ] Push with tags: `git push --follow-tags origin main`
- [ ] Build with Electron Forge: `npm run make`
- [ ] Create GitHub release with tag
- [ ] Upload binaries from `out/make/`
- [ ] Copy changelog entry to release notes
- [ ] Verify auto-update works for users

### Changelog Maintenance

- [ ] Changelog is automatically generated (don't manually edit)
- [ ] Changelog includes all relevant commits since last release
- [ ] Changelog sections are properly categorized (Features, Bug Fixes, etc.)
- [ ] Commit links work correctly
- [ ] Version comparison links work correctly
- [ ] Add manual clarifications if needed (after generation)

### Common Issues

- [ ] If commit validation fails: check commitlint.config.js for valid types/scopes
- [ ] If changelog is missing commits: ensure commits follow conventional format
- [ ] If version bump is wrong: use manual release commands (release:major/minor/patch)
- [ ] If tag already exists: delete tag and re-run release
- [ ] If changelog has duplicates: ensure clean git history before release

---

## Adding Custom Matching Rules with Metadata Field Selection

### Type Definitions

- [ ] Define `CustomRuleTarget` union type in storage.ts (9 variants: titles, author, genres, tags, format, country, source, description, status)
- [ ] Define `CustomRule` interface in storage.ts with `targetFields: CustomRuleTarget[]` property
- [ ] Define `CustomRulesConfig` interface in storage.ts
- [ ] Extend `MatchConfig` type with `customRules` property
- [ ] Update `DEFAULT_MATCH_CONFIG` with empty rule arrays
- [ ] Add validation helper function `validateCustomRule()` for regex patterns and field validation
- [ ] Add migration helper function `migrateCustomRule()` for backward compatibility (defaults targetFields to ['titles'])

### Validation System

- [ ] Implement `checkBasicValidation()` - empty pattern detection
- [ ] Implement `validateTargetFields()` - field validation using Set for performance
- [ ] Implement `checkRedosVulnerabilities()` - detect nested quantifiers, overlapping alternations, catastrophic patterns
- [ ] Implement `checkBroadPatterns()` - detect unbounded wildcards and empty alternations
- [ ] Add complexity warning for patterns >200 characters
- [ ] Ensure all validation checks run and accumulate errors/warnings

### Rule Engine

- [ ] Create `custom-rules.ts` in `src/api/matching/filtering/`
- [ ] Implement `extractMetadataValues()` dispatcher function
- [ ] Implement helper functions: `extractTitles()`, `extractAuthors()`, `extractTags()`, `extractDescriptions()`
- [ ] Handle null/undefined fields gracefully in extraction functions
- [ ] Implement `testRuleAgainstMetadata()` to test pattern against selected fields
- [ ] Implement `shouldSkipByCustomRules()` function with field logging
- [ ] Implement `shouldAcceptByCustomRules()` function with field logging
- [ ] Implement `getCustomRuleMatchInfo()` utility
- [ ] Add comprehensive error handling for invalid regex
- [ ] Add logging for checked fields, matches, and skips
- [ ] Export functions from filtering/index.ts

### Integration with Existing Filters

- [ ] Update `skip-rules.ts` to accept kenmeiManga parameter
- [ ] Add custom skip rule check in shouldSkipManga() that passes targetFields
- [ ] Update `inclusion-rules.ts` to accept kenmeiManga parameter
- [ ] Add custom accept rule check in shouldIncludeManga\*() that passes targetFields
- [ ] Update `ranking.ts` to pass kenmeiManga to filtering functions
- [ ] Update `result-processing.ts` to pass kenmeiManga
- [ ] Update `batching/results.ts` to apply custom rules with metadata context
- [ ] Update `cache-handlers.ts` to support custom rules

### UI Components

- [ ] Create `MetadataFieldSelector.tsx` in `src/components/settings/`
  - [ ] Display 9 metadata fields organized in 3 categories (Text Fields, Metadata, Content Info)
  - [ ] Implement bulk actions: Select All, Clear All, Reset to Default
  - [ ] Add validation requiring at least one field selected
  - [ ] Use fieldset/legend for semantic grouping
  - [ ] Include aria-live and aria-invalid for accessibility
  - [ ] Show field count badge
  - [ ] Use memo optimization for performance

- [ ] Create `RegexDocumentation.tsx` in `src/components/settings/`
  - [ ] Always visible: ReDoS security warning with OWASP link
  - [ ] Always visible: Safe pattern examples (5 examples with bounded patterns)
  - [ ] Always visible: Dangerous patterns with explanations and alternatives
  - [ ] Collapsible sections: Basic Syntax, Quantifiers, Character Classes, Grouping/Alternation
  - [ ] Include badge indicators for pattern safety
  - [ ] Add external resource links (MDN, regex101, regexr, OWASP)
  - [ ] Visual hierarchy with Radix UI components

- [ ] Update `CustomRulesManager.tsx` in `src/components/settings/`
  - [ ] Update RuleFormData interface with `targetFields: CustomRuleTarget[]`
  - [ ] Add migration logic in useState initializer using `migrateCustomRule()`
  - [ ] Update all setRuleForm calls to include targetFields
  - [ ] Wrap entire component in Collapsible with advanced user warning
  - [ ] Add ShieldAlert icon, "Advanced" badge, warning Alert with documentation link
  - [ ] Add MetadataFieldSelector component in dialog form (after description)
  - [ ] Add RegexDocumentation collapsible component in dialog
  - [ ] Add Target Fields column to rules table with badge display
  - [ ] Show first 3 fields as badges, "+X more" for additional fields

### Settings Page Integration

- [ ] Import new UI components in SettingsPage.tsx
- [ ] Add CustomRulesManager to Matching tab
- [ ] Position after existing toggles, before info Alert
- [ ] Update animation delays for sequential stagger
- [ ] Test responsive layout on mobile/tablet/desktop

### Debug Context

- [ ] Update SettingsDebugSnapshot interface to include targetFields
- [ ] Include customRules with full targetFields in getSnapshot()
- [ ] Handle customRules with targetFields in setSnapshot()
- [ ] Display custom rules with selected fields in debug panel

### Testing

- [ ] Test with no custom rules (default state)
- [ ] Test adding skip rules with various targetFields combinations
- [ ] Test adding accept rules with multiple fields
- [ ] Test editing existing rules, loading targetFields correctly
- [ ] Test deleting rules
- [ ] Test enabling/disabling rules
- [ ] Test invalid regex patterns (validation catches them)
- [ ] Test ReDoS pattern detection (warns but allows)
- [ ] Test case-sensitive vs case-insensitive
- [ ] Test rule persistence across app restarts
- [ ] Test backward compatibility (old rules without targetFields default to ['titles'])
- [ ] Test metadata extraction for all 9 field types
- [ ] Test pattern matching against extracted metadata
- [ ] Test with automatic matching using different field combinations
- [ ] Test with manual search (skip rules should not apply)
- [ ] Test with batch operations
- [ ] Test with cached results
- [ ] Test with fallback sources (Comick, MangaDex)

### Documentation

- [ ] Add comprehensive "Custom Matching Rules (Advanced)" section to USER_GUIDE.md
  - [ ] Metadata field selection guide with category breakdown
  - [ ] Comprehensive regex pattern guide with examples
  - [ ] ReDoS vulnerability warnings
  - [ ] External resource links (MDN, regex101, regexr, OWASP)
  - [ ] Best practices and common patterns
  - [ ] Field-specific examples

- [ ] Update critical_patterns_and_anti_patterns.md
  - [ ] Document CustomRuleTarget type and validation
  - [ ] Document metadata extraction for each field type
  - [ ] Add ReDoS vulnerability details and detection patterns
  - [ ] Add security considerations section
  - [ ] Document best practices for metadata field selection

- [ ] Update accessibility_patterns.md
  - [ ] Document "Advanced User Sections Pattern" with Collapsible implementation
  - [ ] Document "Metadata Field Selector Pattern" with fieldset/legend accessibility
  - [ ] Include ARIA labels and aria-live regions
  - [ ] Reference MetadataFieldSelector.tsx implementation

- [ ] Update feature_development_checklist.md
  - [ ] Add checklist items for metadata field selection feature
  - [ ] Add validation checklist items for ReDoS detection
  - [ ] Add testing requirements for all field types
  - [ ] Add documentation requirements

- [ ] Update ARCHITECTURE.md
  - [ ] Add section on metadata field selection in custom matching rules
  - [ ] Document rule structure with targetFields property
  - [ ] Explain metadata extraction step in evaluation flow
  - [ ] Add ReDoS vulnerability detection documentation
  - [ ] Add performance considerations for metadata extraction

- [ ] Update README.md
  - [ ] Change custom matching rules feature description to include "(Advanced)" designation
  - [ ] Mention metadata field selection capability
  - [ ] Add ReDoS detection to security note

### Edge Cases

- [ ] Handle malformed customRules in storage (migration to new targetFields)
- [ ] Handle undefined customRules (backward compatibility)
- [ ] Handle empty pattern strings
- [ ] Handle very long patterns (performance)
- [ ] Handle special regex characters in user input
- [ ] Handle rules that match everything (warn user)
- [ ] Handle conflicting skip and accept rules (skip takes precedence)
- [ ] Handle null/undefined field values in manga data (graceful extraction)
- [ ] Handle empty targetFields array (validation prevents save)
- [ ] Handle multiple overlapping targetFields (all checked, OR logic)
