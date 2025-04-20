# Testing Framework

This project uses two primary testing frameworks:

- **Vitest**: For unit and component testing
- **Playwright**: For end-to-end (E2E) testing

## Test Directory Structure

```
src/
└── tests/
    ├── unit/           # Vitest unit and component tests
    │   ├── components/ # Tests for React components
    │   ├── utils/      # Tests for utility functions
    │   ├── api/        # Tests for API functions
    │   ├── contexts/   # Tests for context providers
    │   └── hooks/      # Tests for custom hooks
    ├── e2e/            # Playwright end-to-end tests
    ├── fixtures/       # Test data fixtures
    ├── mocks/          # Mock services and data
    └── README.md       # Testing documentation
```

## Unit and Component Testing

Unit tests are located in `src/tests/unit/` and are organized to mirror the project structure.

### Running Unit Tests

```bash
# Run all unit tests
npm run test

# Run unit tests in watch mode (during development)
npm run test:watch

# Run specific unit test files or directories
npm run test:unit -- --dir=src/tests/unit/components
```

## End-to-End Testing

E2E tests are located in `src/tests/e2e/` and test the application as a whole.

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run all tests (both unit and E2E)
npm run test:all
```

## Test Fixtures and Mocks

The project includes test fixtures and mocks to facilitate testing:

- **Fixtures**: Predefined test data located in `src/tests/fixtures/`
- **Mocks**: Mock implementations of services in `src/tests/mocks/`

### Using Fixtures

```typescript
import { mockKenmeiManga, mockAniListManga } from '@/tests/fixtures/manga';

describe('MyComponent', () => {
  it('renders manga entries', () => {
    render(<MyComponent mangaEntries={mockKenmeiManga} />);
    // Test assertions...
  });
});
```

### Using Mocks

```typescript
import { MockAniListApi } from '@/tests/mocks/anilist-api';

describe('Synchronization', () => {
  const mockApi = new MockAniListApi();

  beforeEach(() => {
    mockApi.reset();
  });

  it('updates manga entries', async () => {
    // Test with mock API...
    const result = await mockApi.updateMangaEntry(101, 'CURRENT', 1050);
    expect(result.progress).toBe(1050);
  });
});
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/utils/myModule';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should return expected result', () => {
      expect(myFunction()).toBe('expected result');
    });
  });
});
```

### Component Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Some Text')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<MyComponent onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Context Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { MyProvider, useMyContext } from '@/contexts/MyContext';

describe('MyContext', () => {
  it('provides context to children', () => {
    const { result } = renderHook(() => useMyContext(), {
      wrapper: ({ children }) => <MyProvider>{children}</MyProvider>
    });
    
    expect(result.current.value).toBe('default');
    
    act(() => {
      result.current.setValue('new value');
    });
    
    expect(result.current.value).toBe('new value');
  });
});
```

### Hook Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '@/hooks/useMyHook';

describe('useMyHook', () => {
  it('returns expected values', () => {
    const { result } = renderHook(() => useMyHook());
    
    expect(result.current.count).toBe(0);
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('application flows', async () => {
  const electronApp = await electron.launch({
    args: ['path/to/your/app.js']
  });
  
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  
  // Test application behavior
  await window.click('button:has-text("Submit")');
  await expect(window.locator('.success-message')).toBeVisible();
  
  await electronApp.close();
});
```

## CI Integration

Tests are automatically run in GitHub Actions when code is pushed or pull requests are created against the main branch.

## Coverage Reports

Coverage reports are generated when running the full test suite and can be found in the `coverage/` directory. 

To view the coverage report, run:

```bash
npm run test
```

and open `coverage/index.html` in your browser. 