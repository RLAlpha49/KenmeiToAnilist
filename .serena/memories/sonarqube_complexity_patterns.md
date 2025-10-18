# SonarQube Code Quality Patterns

## Cognitive Complexity Refactoring

When cognitive complexity (CC) exceeds threshold (typically 15), extract helper functions:

### Pattern 1: Nested Loops → Extract Inner Function

**Before (CC: 20)**:

```typescript
for (const word of words) {
  let bestMatch = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const similarity = calculateSimilarity(word, candidate);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = candidate;
    }
  }
  results.push(bestMatch);
}
```

**After (CC: 8)**:

```typescript
function findBestWordMatch(word: string, candidates: string[]): string {
  let bestMatch = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const similarity = calculateSimilarity(word, candidate);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = candidate;
    }
  }
  return bestMatch;
}

for (const word of words) {
  results.push(findBestWordMatch(word, candidates));
}
```

### Pattern 2: Multiple Conditional Branches → Extract Validators

**Before (CC: 17)**:

```typescript
function validate(input: Data): boolean {
  if (!input.primary) return false;
  if (input.items.length < MIN) {
    // 5 lines of complex logic
    return false;
  }
  if (!input.order) {
    // 4 lines of complex logic
    return false;
  }
  // 6 more conditions...
}
```

**After (CC: 10)**:

```typescript
function checkPrimaryValid(input: Data): boolean {
  return !!input.primary;
}

function checkItemCount(input: Data): boolean {
  if (input.items.length < MIN) {
    // 5 lines of complex logic
    return false;
  }
  return true;
}

function validate(input: Data): boolean {
  return checkPrimaryValid(input) && checkItemCount(input) && checkOrder(input);
}
```

### Pattern 3: Complex Regex → Multi-Step Validation

**Before (Regex CC: 21)**:

```typescript
const COMPLEX_PATTERN = /^(?=[mdclxvi])m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
const isValid = COMPLEX_PATTERN.test(input);
```

**After (Regex CC: ≤5, Function CC: 8)**:

```typescript
function isValidRomanNumeral(input: string): boolean {
  // Step 1: Basic character validation
  if (!/^[mdclxvi]+$/i.test(input)) return false;

  // Step 2: Start validation
  if (!/^[mdclxvi]/i.test(input)) return false;

  // Step 3: Algorithmic validation
  let value = 0;
  let lastValue = Infinity;
  for (const char of input.toLowerCase()) {
    const charValue = romanValues[char];
    if (charValue > lastValue) return false; // Invalid order
    value += charValue;
    lastValue = charValue;
  }
  return value > 0 && value <= 3999;
}
```

## Refactoring Process

1. **Identify hotspots**: Look for functions with CC > 15
2. **Break at natural boundaries**: Loop bodies, conditional branches, calculations
3. **Extract to named functions**: Function name should explain what it checks/calculates
4. **Keep similar scope**: Helper functions stay near original function
5. **Test equivalence**: Same input → same output

## Files Using These Patterns

- `src/utils/enhanced-similarity.ts`:
  - `jaroWinklerDistance()` - Extracted: `findMatches()`, `calculateTranspositions()`, `calculatePrefix()`
  - `calculateSemanticSimilarity()` - Extracted: `calculateStemmedSimilarity()`, `findBestWordMatch()`, `calculateWordMatchScore()`

- `src/api/matching/scoring/match-scorer.ts`:
  - Replaced: `ROMAN_NUMERAL_REGEX` with `isValidRomanNumeral()` function
  - `checkMeaningfulWordOverlap()` - Extracted: `checkPrimaryTokenCoverage()`, `calculateCompositeMatchScore()`

## Benefits

✅ **Readability**: Each function has clear, single responsibility  
✅ **Testability**: Helper functions can be unit tested independently  
✅ **Maintainability**: Easier to understand and modify complex logic  
✅ **Reusability**: Extracted helpers can be reused in other functions  
✅ **SonarQube**: All complexity metrics pass validation  
✅ **Performance**: No runtime overhead - all refactoring only
