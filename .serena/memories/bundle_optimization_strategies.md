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

- Total bundle size: ~3.3MB (gzipped ~900KB)
- Largest chunk: vendor (~596KB)
- Lazy-loaded: debug (~160KB), statistics (~65KB), settings (~50KB)
- All chunks under 600KB with good distribution

## Lazy Loading Strategy

**Implemented Lazy Loading**:

1. **Debug Components** (~50KB total):
   - DebugMenu + 5 sub-components
   - ConfidenceTestExporter
   - Only loaded when debug mode active
   - Pattern: `React.lazy()` + Suspense wrapper + error boundary

2. **Low-Priority Pages** (~200KB total):
   - SettingsPage (~50KB): Infrequently accessed
   - StatisticsPage (~150KB): Includes recharts dependency
   - Loaded on first navigation
   - Pattern: TanStack Router lazy routes with root Suspense boundary

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

**When to Lazy Load**:

- Components used conditionally (debug tools)
- Large dependencies (recharts, xlsx)
- Infrequently accessed features (settings, statistics)
- Route-level code splitting

**When NOT to Lazy Load**:

- Core UI components (buttons, inputs)
- Frequently used features (matching, sync)
- Small components (<10KB)
- Critical path components

## Vendor Chunk Strategy

**Chunk Breakdown**:

1. **vendor-react** (~150KB):
   - react + react-dom
   - Core framework, rarely changes
   - Cached long-term

2. **vendor-radix** (~200KB):
   - All @radix-ui packages
   - UI primitives, stable
   - Shared across all pages

3. **vendor-recharts** (~150KB):
   - recharts library
   - Only loaded with StatisticsPage
   - Lazy loaded on demand

4. **vendor-ui-framework** (~200KB):
   - framer-motion, lucide-react, sonner
   - Animation and UI utilities
   - Used throughout app

5. **vendor-data** (~150KB):
   - papaparse, xlsx, natural, string-similarity
   - Data processing libraries
   - Used in import/export features

6. **vendor-tanstack** (~50KB):
   - @tanstack/react-router
   - Routing library

7. **vendor** (~100KB):
   - Other dependencies
   - Miscellaneous utilities

**Chunk Strategy Rationale**:

- Separate by update frequency (React rarely updates)
- Separate by usage pattern (recharts only with StatisticsPage)
- Group related dependencies (all Radix UI together)
- Balance chunk size (avoid too many small chunks)

## TailwindCSS Optimization

**Content Configuration**:

- Explicit paths for all source files
- Includes components, pages, routes, contexts, hooks, utils
- Improves purging accuracy

**Safelist Strategy**:

- Preserve dynamically generated classes
- Status colors (emerald, sky, amber, rose, purple)
- Ring widths and colors for focus/selection states
- Animation classes (spin, pulse, bounce)
- Dark mode variants

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

**Electron Forge**:

- ASAR enabled for code protection
- Fuses for security hardening
- Platform-specific builds

## Performance Metrics

**Current Bundle (v3.0.0)** _(approximate, measured locally)_:

- Total bundle: ~3.3MB (uncompressed)
- Gzipped: ~900KB
- Largest chunk: vendor (~596KB)
- All chunks: <600KB (good distribution)
- Lazy-loaded: ~275KB deferred (debug + statistics + settings)

**Lazy Loading Impact**:

- Debug components: -160KB (loaded on demand)
- StatisticsPage: -65KB (loaded on navigation)
- SettingsPage: -50KB (loaded on navigation)
- Total deferred: ~275KB

**Before Optimization** (estimated baseline):

- Total bundle: ~3.6MB
- Largest chunk: ~900KB
- Time to interactive: ~3-4s

**After Optimization** (v3.0.0):

- Total bundle: ~3.3MB (-8%)
- Largest chunk: ~596KB (-34%)
- Time to interactive: ~2-3s (-25%)

_Note: Metrics are approximate and measured locally on a specific machine with `ANALYZE=true` flag using Vite 7 and Electron 38. Actual results may vary based on system specifications and configuration changes._

**Future Optimization Potential**:

1. Aggressive tree-shaking of vendor code
2. Further splitting of `app-matching` (354KB)
3. Splitting of "vendor" chunk (596KB) by dependency type
4. Dynamic imports for heavy utilities (xlsx, natural)

## Monitoring and Maintenance

**Bundle Size Monitoring**:

- GitHub Actions workflow (bundle-size.yml)
- Runs on PR and main branch pushes
- Checks against thresholds (2MB warning, 2.5MB error)
- Comments on PR with bundle size

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
- Split by usage (debug tools, statistics)
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

// ❌ Bad: Synchronous import for large component
import { Settings } from "./SettingsPage";
```

**Vendor Chunks**:

```typescript
// ✅ Good: Separate frequently-updated code
if (id.includes("node_modules/react")) return "vendor-react";

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

**Lazy Loading Errors**:

1. Check Suspense boundaries
2. Verify import paths
3. Check for circular dependencies
4. Review error boundaries for proper fallbacks

## Future Optimizations

**Potential Improvements**:

- Preload critical chunks
- Implement service worker for caching
- Use dynamic imports for heavy computations
- Optimize image assets
- Implement progressive loading

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

## Lazy Loading Strategy

**Implemented Lazy Loading**:

1. **Debug Components** (~50KB total):
   - DebugMenu + 5 sub-components
   - ConfidenceTestExporter
   - Only loaded when debug mode active
   - Pattern: `React.lazy()` + Suspense wrapper

2. **Low-Priority Pages** (~200KB total):
   - SettingsPage (~50KB): Infrequently accessed
   - StatisticsPage (~150KB): Includes recharts dependency
   - Loaded on first navigation
   - Pattern: TanStack Router lazy routes

**Lazy Loading Pattern**:

```typescript
// Create lazy wrapper
import { lazy, Suspense } from "react";
import { LoadingFallback } from "./loading-fallback";

const Component = lazy(() => import("./Component"));

export function LazyComponent(props) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Component {...props} />
    </Suspense>
  );
}
```

**When to Lazy Load**:

- Components used conditionally (debug tools)
- Large dependencies (recharts, xlsx)
- Infrequently accessed features (settings, statistics)
- Route-level code splitting

**When NOT to Lazy Load**:

- Core UI components (buttons, inputs)
- Frequently used features (matching, sync)
- Small components (<10KB)
- Critical path components

## Vendor Chunk Strategy

**Chunk Breakdown**:

1. **vendor-react** (~150KB):
   - react + react-dom
   - Core framework, rarely changes
   - Cached long-term

2. **vendor-radix** (~200KB):
   - All @radix-ui packages
   - UI primitives, stable
   - Shared across all pages

3. **vendor-recharts** (~150KB):
   - recharts library
   - Only loaded with StatisticsPage
   - Lazy loaded on demand

4. **vendor-ui-framework** (~200KB):
   - framer-motion, lucide-react, sonner
   - Animation and UI utilities
   - Used throughout app

5. **vendor-data** (~150KB):
   - papaparse, xlsx, natural, string-similarity
   - Data processing libraries
   - Used in import/export features

6. **vendor-tanstack** (~50KB):
   - @tanstack/react-router
   - Routing library

7. **vendor** (~100KB):
   - Other dependencies
   - Miscellaneous utilities

**Chunk Strategy Rationale**:

- Separate by update frequency (React rarely updates)
- Separate by usage pattern (recharts only with StatisticsPage)
- Group related dependencies (all Radix UI together)
- Balance chunk size (avoid too many small chunks)

## TailwindCSS Optimization

**Content Configuration**:

- Explicit paths for all source files
- Includes components, pages, routes, contexts, hooks, utils
- Improves purging accuracy

**Safelist Strategy**:

- Preserve dynamically generated classes
- Status colors (emerald, sky, amber, rose, purple)
- Ring colors for focus/selection states
- Animation classes (spin, pulse, bounce)
- Dark mode variants

**Dynamic Class Patterns**:

```typescript
// These patterns require safelist:
const color = getStatusBadgeColor(status); // Returns "text-emerald-600"
const className = cn("ring-blue-400", isSelected && "ring-2");
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

**Electron Forge**:

- ASAR enabled for code protection
- Fuses for security hardening
- Platform-specific builds

## Performance Metrics

**Current Bundle (v3.0.0)**:

- Total bundle: ~3.3MB (uncompressed)
- Gzipped: ~900KB
- Largest chunk: vendor (~596KB)
- All chunks: <600KB (good distribution)
- Lazy-loaded: ~275KB deferred (debug + statistics + settings)

**Lazy Loading Impact**:

- Debug components: -160KB (loaded on demand)
- StatisticsPage: -65KB (loaded on navigation)
- SettingsPage: -50KB (loaded on navigation)
- Total deferred: ~275KB

**Before Optimization** (estimated baseline):

- Total bundle: ~3.6MB
- Largest chunk: ~900KB
- Time to interactive: ~3-4s

**After Optimization** (v3.0.0):

- Total bundle: ~3.3MB (-8%)
- Largest chunk: ~596KB (-34%)
- Time to interactive: ~2-3s (-25%)

**Future Optimization Potential**:

1. Aggressive tree-shaking of vendor code
2. Further splitting of `app-matching` (354KB)
3. Splitting of "vendor" chunk (596KB) by dependency type
4. Dynamic imports for heavy utilities (xlsx, natural)

## Monitoring and Maintenance

**Bundle Size Monitoring**:

- GitHub Actions workflow (bundle-size.yml)
- Runs on PR and main branch pushes
- Checks against thresholds (2MB warning, 2.5MB error)
- Comments on PR with bundle size

**Regular Audits**:

- Run `npm run analyze:bundle` monthly
- Review large dependencies
- Check for duplicate dependencies
- Identify optimization opportunities

**Dependency Management**:

- Audit new dependencies before adding
- Check bundle size impact
- Consider alternatives (e.g., date-fns vs moment)
- Use tree-shakeable libraries

## Best Practices

**Code Splitting**:

- Split by route (page-level)
- Split by feature (matching, sync, import)
- Split by usage (debug tools, statistics)
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
// ✅ Good: Lazy load with Suspense
const Settings = lazy(() => import("./SettingsPage"));

// ❌ Bad: Synchronous import for large component
import { Settings } from "./SettingsPage";
```

**Vendor Chunks**:

```typescript
// ✅ Good: Separate frequently-updated code
if (id.includes("node_modules/react")) return "vendor-react";

// ❌ Bad: All vendors in one chunk
if (id.includes("node_modules")) return "vendor";
```

## Troubleshooting

**Large Bundle Size**:

1. Run bundle analysis
2. Identify largest chunks
3. Check for duplicate dependencies
4. Implement lazy loading
5. Review import patterns

**Slow Initial Load**:

1. Check network waterfall
2. Verify chunk loading order
3. Implement preloading for critical chunks
4. Optimize vendor chunk splitting

**Lazy Loading Errors**:

1. Check Suspense boundaries
2. Verify import paths
3. Check for circular dependencies
4. Review error boundaries

## Future Optimizations

**Potential Improvements**:

- Preload critical chunks
- Implement service worker for caching
- Use dynamic imports for heavy computations
- Optimize image assets
- Implement progressive loading

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
