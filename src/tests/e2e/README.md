# End-to-End Tests

This directory contains end-to-end (E2E) tests for the Kenmei to AniList application. These tests verify that the application works correctly from a user's perspective by automating interactions with the app interface.

## Running the Tests

To run all E2E tests:

```bash
npm run test:e2e
```

To run a specific test file:

```bash
npx playwright test matching-flow
```

To run tests with the UI mode for debugging:

```bash
npx playwright test --ui
```

## Test Environment

The E2E tests use Playwright to launch and interact with the Electron application. They:

1. Launch the app in a test environment
2. Mock necessary API responses and authentication
3. Simulate user interactions with the interface
4. Verify expected behavior and UI states

## Writing New Tests

When writing new E2E tests:

1. Use the existing test files as templates
2. Mock any external dependencies (API calls, authentication)
3. Use descriptive console logs to help with debugging
4. Test complete user flows rather than isolated features
5. Verify both UI changes and underlying data state where possible

## Robust Selector Strategies

Because the application's UI can change, it's important to use robust selector strategies:

1. **Use the helper functions** in `e2e-test-utils.ts` which have fallback mechanisms
2. **Try multiple selectors** for the same element:

```typescript
// Try different selectors for finding an element
const selectors = ['.primary-button', 'button:has-text("Submit")', '[data-testid="submit"]'];
let button = null;

for (const selector of selectors) {
  console.log(`Trying selector: ${selector}`);
  button = await window.$(selector);
  if (button) {
    console.log(`Found element with selector: ${selector}`);
    break;
  }
}

if (button) {
  await button.click();
} else {
  console.log("Could not find element with any selector");
}
```

3. **Take screenshots** at key points to help with debugging:

```typescript
await window.screenshot({ path: 'before-action.png' });
// Perform action
await window.screenshot({ path: 'after-action.png' });
```

4. **Log page content** when elements can't be found:

```typescript
if (!element) {
  const content = await window.content();
  console.log("Page content:", content.substring(0, 1000));
}
```

## Common Patterns

### Launching the App

```typescript
// Find the latest build of your application
const latestBuild = findLatestBuild();
const appInfo = parseElectronApp(latestBuild);

// Launch Electron app
const electronApp = await electron.launch({
  args: [appInfo.main],
  executablePath: appInfo.executable,
});

// Get the first window
const window = await electronApp.firstWindow();
```

### Mocking Authentication

```typescript
await window.evaluate(() => {
  localStorage.setItem('anilist_auth', JSON.stringify({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + (3600 * 1000),
    tokenType: 'Bearer',
    isAuthenticated: true
  }));
});
```

### Mocking API Responses

```typescript
await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.handle('anilist:search-manga', (event, query) => {
    // Return mock search results
    return {
      data: {
        // Mock response structure
      }
    };
  });
});
```

### Navigation

```typescript
// Navigate to a specific route
await window.goto('#/review');

// Click a navigation link
await window.getByText('Settings').click();
```

### Making Assertions

```typescript
// Check element existence
const element = await window.getByText('Review Matches');
expect(element).not.toBeNull();

// Verify element count
const items = await window.$$('.manga-item');
expect(items.length).toBe(3);

// Wait for specific text to appear
await window.waitForSelector('text=Matching complete', {
  timeout: 5000,
  state: 'visible'
});
```

## Troubleshooting

If tests are failing, try these steps:

1. Run with the UI mode to visually debug: `npx playwright test --ui`
2. Increase timeouts for asynchronous operations that may take longer
3. Add more detailed console logs to pinpoint failures
4. Check that selectors still match the current UI implementation
5. Verify that mocked data matches expected application state

### Selector Issues

If you have trouble with selectors, try these approaches:

1. **Use multiple selectors** with fallbacks as shown above
2. **Use text-based selectors** which tend to be more stable: `text=Submit` 
3. **Add data-testid attributes** to important elements: `[data-testid="submit-button"]`
4. **Use role-based selectors**: `role=button[name="Submit"]`
5. **Look at the screenshots** generated during test runs
6. **Inspect the DOM** using `window.evaluate()` to log element details
7. **Use more generic selectors** if specific ones are not working

```typescript
// If a specific selector isn't working, try a more general approach
const anyButton = await window.$('button');
if (anyButton) {
  const buttonText = await anyButton.innerText();
  console.log(`Found button with text: ${buttonText}`);
}
```

### Using try/catch for Resilience

Make tests more resilient with try/catch blocks:

```typescript
try {
  // Try the ideal path
  await window.click('button:has-text("Start")');
} catch (error) {
  console.log("Primary action failed, trying fallback:", error);
  
  try {
    // Try a fallback approach
    const anyButton = await window.$('button');
    if (anyButton) await anyButton.click();
  } catch (fallbackError) {
    console.log("Fallback also failed:", fallbackError);
    // Continue with test or take screenshot
    await window.screenshot({ path: 'error-state.png' });
  }
} 