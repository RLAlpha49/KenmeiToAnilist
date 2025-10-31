# Bundle Optimization Strategies

## Overview

This document outlines bundle optimization strategies implemented in KenmeiToAnilist to reduce initial load time and improve performance.

## Bundle Analysis

**Built-in Tools**:

- `npm run analyze:bundle`: Full production build with detailed output
- `npm run analyze:size`: Analyze generated bundle chunks (prints size report to console)

**Visualizer Tool**:

- `rollup-plugin-visualizer`: Interactive treemap/sunburst visualization
  - Automatically enabled when `ANALYZE=true` flag is set
  - Generates `.vite/bundle-analysis.html` on build
  - Run: `npm run analyze:bundle`

**Analysis Process**:

1. Run `npm run analyze:bundle` to build and generate visualization
2. Open `.vite/bundle-analysis.html` in a browser for interactive analysis
3. Run `npm run analyze:size` to see text-based breakdown
4. Identify large chunks and optimization opportunities
5. Implement lazy loading or code splitting

**Key Metrics** _(approximate, may vary by environment)_:

- Total bundle size: ~3.0MB (gzipped ~820KB)
- Largest chunk: vendor-radix (~200KB)
- Lazy-loaded: debug (~160KB), statistics (~65KB), settings (~50KB), export (~40KB)
- All chunks under 300KB with good distribution

## Recent Optimizations (v3.1.0)

**Implemented Changes:**

1. **Removed Unused Dependencies** (~270KB savings):
   - `natural` (50KB): Porter stemming implemented manually in `enhanced-similarity.ts`
   - `fuse.js` (20KB): Never used, likely planned for future feature
   - `exceljs` (200KB): Never used, CSV handled by papaparse and custom parser
   - **Impact:** 8% reduction in total bundle size

2. **Lazy Loaded Export Utilities** (~40KB deferred):
   - `papaparse` now dynamically imported in `exportUtils.ts`
   - Only loads when user triggers CSV export
   - Used by `ExportMatchesButton` and `ExportStatisticsButton`
   - First export has ~50-100ms delay (acceptable for user action)
   - **Impact:** 40KB removed from initial bundle

3. **Optimized Vendor Chunks**:
   - Created separate `vendor-export` chunk for papaparse
   - Reduced `vendor-data` chunk from 150KB to 110KB
   - Better cache granularity (matching changes don't invalidate export chunk)
   - **Impact:** Improved cache hit rate

4. **Refined TailwindCSS Safelist** (~5KB CSS savings):
   - Removed 6 unused purple status color entries
   - Kept only dynamically generated classes (confidence badges, rings, animations)
   - Added documentation comments explaining safelist purpose
   - **Impact:** Smaller CSS bundle, better purging accuracy

5. **Added Modulepreload Hints**:
   - Preload critical chunks: vendor-react, vendor-radix, vendor-ui-framework, vendor-tanstack
   - Browser downloads chunks in parallel instead of sequentially
   - **Impact:** 20-30% improvement in time-to-interactive

**Updated Metrics (v3.1.0):**

- Total bundle: ~3.0MB (-9% from v3.0.0)
- Gzipped: ~820KB (-9% from v3.0.0)
- Largest chunk: vendor-radix (~200KB, down from 596KB vendor chunk)
- Initial load: ~2.7MB (papaparse deferred)
- Time to interactive: ~1.5-2s (-33% from v3.0.0)

**Deferred Loading:**

- Debug components: ~160KB
- StatisticsPage: ~65KB
- SettingsPage: ~50KB
- Export utilities: ~40KB (NEW)
- **Total deferred: ~315KB**

## Lazy Loading Strategy

**Implemented Lazy Loading**:

1. **Debug Components** (~160KB total):
   - DebugMenu + 5 sub-components
   - ConfidenceTestExporter
   - Only loaded when debug mode active
   - Pattern: `React.lazy()` + Suspense wrapper + error boundary

2. **Low-Priority Pages** (~115KB total):
   - SettingsPage (~50KB): Infrequently accessed
   - StatisticsPage (~65KB): Includes recharts dependency
   - Loaded on first navigation
   - Pattern: TanStack Router lazy routes with root Suspense boundary

3. **Export Utilities** (~40KB):
   - `papaparse` library
   - Loaded only when user clicks export button
   - Used by ExportMatchesButton and ExportStatisticsButton
   - Pattern: Dynamic import with async/await

**Lazy Loading Pattern**:

```typescript
// Create lazy wrapper with error boundary
import { lazy, Suspense } from "react";
import { LoadingFallback } from "./loading-fallback";

const Component = lazy(() => import("./Component"));

class ErrorBoundary extends Component<...> {
  // Handle load errors gracefully
}

export function LazyComponent(props) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

**Dynamic Import Pattern**:

```typescript
// For small libraries loaded on demand
async function loadPapaparse(): Promise<typeof import("papaparse").default> {
  const module = await import("papaparse");
  return module.default;
}

export async function exportToCSV(
  data: Record<string, unknown>[],
  baseFilename: string,
): Promise<string> {
  const Papa = await loadPapaparse();
  // Use Papa...
}
```

**When to Lazy Load**:

- Components used conditionally (debug tools)
- Large dependencies (recharts, papaparse)
- Infrequently accessed features (settings, statistics)
- Route-level code splitting
- User-initiated operations (export, advanced features)

**When NOT to Lazy Load**:

- Core UI components (buttons, inputs)
- Frequently used features (matching, sync)
- Small components (<10KB)
- Critical path components
- High-priority features

## Vendor Chunk Strategy

**Chunk Breakdown**:

1. **vendor-radix** (~200KB):
   - All @radix-ui packages
   - UI primitives, stable
   - Shared across all pages
   - Preloaded for better performance

2. **vendor-recharts** (~150KB):
   - recharts library
   - Only loaded with StatisticsPage
   - Lazy loaded on demand

3. **vendor-ui-framework** (~200KB):
   - framer-motion, lucide-react, sonner
   - Animation and UI utilities
   - Used throughout app
   - Preloaded for better performance

4. **vendor-data** (~110KB):
   - string-similarity, fastest-levenshtein
   - Matching libraries only (papaparse moved to vendor-export)
   - Used in import and matching operations

5. **vendor-export** (~40KB):
   - papaparse library
   - Lazy loaded on-demand
   - Only loads when user clicks export button

6. **vendor-tanstack** (~50KB):
   - @tanstack/react-router
   - Routing library
   - Preloaded for navigation

7. **vendor-sentry** (~50KB):
   - @sentry/electron
   - Error tracking
   - Not preloaded (not critical path)

8. **vendor** (~100KB):
   - Other dependencies
   - Miscellaneous utilities

**Chunk Strategy Rationale**:

- Separate by usage pattern (export only on demand)
- Separate by size (keep chunks balanced)
- Group related dependencies (all Radix UI together)
- Preload critical chunks (radix, ui-framework, tanstack)
- Lazy load optional chunks (recharts, export)

## TailwindCSS Optimization

**Content Configuration**:

- Explicit paths for all source files
- Includes components, pages, routes, contexts, hooks, utils
- Improves purging accuracy

**Safelist Strategy**:

- Preserve dynamically generated classes
- Confidence badges: emerald (high), blue (good), amber (medium), rose (low)
- Ring utilities for focus/selection states
- Animation classes (spin, pulse, bounce)
- Removed unused purple status colors (used statically, not dynamically)

**Dynamic Class Patterns**:

```typescript
// These patterns require safelist:
const color = getStatusBadgeColor(status); // Returns "text-emerald-600"
const className = cn("ring-1", "ring-2", isSelected && "ring-blue-400");
```

**Production Optimization**:

- Unused classes automatically purged
- Safelist prevents purging of dynamic classes
- Result: ~80% reduction in CSS size

## Build Configuration

**Vite Optimizations**:

- `cssCodeSplit: false` - Single CSS file for better caching
- `assetsInlineLimit: 0` - No inline assets, better caching
- `minify: "esbuild"` - Fast minification
- Manual chunks for granular control
- Path normalization helper for cross-platform compatibility

**Modulepreload Hints**:

- Preload critical chunks in `index.html`
- Enables parallel downloading of critical resources
- Browser can start processing chunks while others load
- Improves time-to-interactive significantly

**Electron Forge**:

- ASAR enabled for code protection
- Fuses for security hardening
- Platform-specific builds

## Performance Metrics

**Updated Metrics (v3.1.0):**

- Total bundle: ~3.0MB (-17% from baseline)
- Largest chunk: ~200KB (-78% from baseline)
- Time to interactive: ~1.5-2s (-50% from baseline)
- Initial load: ~2.7MB (315KB deferred)
- Gzipped: ~820KB (-9% from v3.0.0)

**Lazy Loading Impact:**

- Debug components: -160KB (loaded on demand)
- StatisticsPage: -65KB (loaded on navigation)
- SettingsPage: -50KB (loaded on navigation)
- Export utilities: -40KB (loaded on export)
- **Total deferred: ~315KB**

**Before Optimization** (estimated baseline):

- Total bundle: ~3.6MB
- Largest chunk: ~900KB
- Time to interactive: ~3-4s

**After Optimization** (v3.1.0):

- Total bundle: ~3.0MB (-17%)
- Largest chunk: ~200KB (-78%)
- Time to interactive: ~1.5-2s (-50%)

_Note: Metrics are approximate and measured locally on a specific machine with `ANALYZE=true` flag using Vite 7 and Electron 38. Actual results may vary based on system specifications and configuration changes._

## Monitoring and Maintenance

**Bundle Size Thresholds:**

- Warning: 1.8MB (down from 2MB)
- Error: 2.2MB (down from 2.5MB)
- Target: <1.5MB for initial load

**Regular Audits**:

- Run `npm run analyze:bundle` monthly
- Review large chunks and optimization opportunities
- Check for duplicate dependencies
- Monitor visualizer output at `.vite/bundle-analysis.html`

**Dependency Management**:

- Audit new dependencies before adding
- Check bundle size impact
- Consider alternatives (e.g., date-fns vs moment)
- Use tree-shakeable libraries

## Best Practices

**Code Splitting**:

- Split by route (page-level)
- Split by feature (matching, sync, import)
- Split by usage (debug tools, statistics, export)
- Avoid over-splitting (too many chunks)

**Import Optimization**:

```typescript
// ✅ Good: Named imports (tree-shakeable)
import { Button } from "@/components/ui/button";

// ❌ Bad: Namespace imports (not tree-shakeable)
import * as UI from "@/components/ui";

// ✅ Good: Specific icon imports
import { Home, Settings } from "lucide-react";

// ❌ Bad: Import all icons
import * as Icons from "lucide-react";
```

**Lazy Loading**:

```typescript
// ✅ Good: Lazy load with Suspense and error boundary
const Settings = lazy(() => import("./SettingsPage"));

// ✅ Better: Include error boundary for robustness
const Component = () => (
  <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Settings />
    </Suspense>
  </ErrorBoundary>
);

// ✅ Good: Dynamic import for heavy utilities
async function loadPapaparse() {
  const module = await import('papaparse');
  return module.default;
}

// ❌ Bad: Synchronous import for large component
import { Settings } from "./SettingsPage";
```

**Vendor Chunks**:

```typescript
// ✅ Good: Separate frequently-updated code
if (id.includes("node_modules/react")) return "vendor-react";

// ✅ Good: Separate by usage pattern
if (id.includes("node_modules/papaparse")) return "vendor-export";

// ❌ Bad: All vendors in one chunk
if (id.includes("node_modules")) return "vendor";
```

## Troubleshooting

**Large Bundle Size**:

1. Run `npm run analyze:bundle`
2. Open `.vite/bundle-analysis.html` for visualization
3. Identify largest chunks
4. Check for duplicate dependencies
5. Implement lazy loading
6. Review import patterns

**Slow Initial Load**:

1. Check network waterfall
2. Verify chunk loading order
3. Implement preloading for critical chunks
4. Optimize vendor chunk splitting
5. Check for missing modulepreload hints

**Lazy Loading Errors**:

1. Check Suspense boundaries
2. Verify import paths
3. Check for circular dependencies
4. Review error boundaries for proper fallbacks
5. Ensure dynamic imports are used in async contexts

## Future Optimization Potential

**Potential Improvements**:

1. Implement route-based code splitting with React.lazy()
2. Further split app-matching chunk (354KB) by feature
3. Optimize image assets (compress, use WebP)
4. Implement service worker for offline caching
5. Consider replacing recharts with lighter charting library
6. Evaluate string-similarity alternatives (smaller bundle)

**Monitoring Enhancements**:

- Track bundle size trends over time
- Compare with base branch in PRs
- Alert on significant size increases
- Detailed chunk analysis in CI/CD

## References

- [Vite Code Splitting](https://vitejs.dev/guide/build.html#chunking-strategy)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [TanStack Router Lazy Routes](https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting)
- [TailwindCSS Optimization](https://tailwindcss.com/docs/optimizing-for-production)
- [Modulepreload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload)
