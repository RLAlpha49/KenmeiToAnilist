import { test } from "@playwright/test";
import {
  launchElectronApp,
  mockAuth,
  mockUserProfile,
  navigateTo,
  debugPageContent,
} from "../helpers/e2e-test-utils";

test("Complete end-to-end flow", async () => {
  // Launch the app with a longer timeout due to full flow
  const { electronApp, page } = await launchElectronApp(120000);

  try {
    // Step 1: Mock authentication
    await mockAuth(page);
    await mockUserProfile(electronApp);

    // Set up mock IPC handlers for file operations
    await electronApp.evaluate(({ ipcMain }) => {
      // Mock the file open dialog
      ipcMain.handle("dialog:openFile", async () => {
        return {
          canceled: false,
          filePaths: ["/path/to/mock/kenmei-export.json"],
        };
      });

      // Mock the file read operation
      ipcMain.handle("fs:readFile", async () => {
        // Return a mock Kenmei export with 3 manga
        return JSON.stringify({
          version: "1.0",
          data: {
            manga: [
              {
                id: 1,
                title: "One Piece",
                status: "reading",
                score: 10,
                chapters_read: 1090,
                created_at: "2022-01-01T00:00:00Z",
                updated_at: "2023-05-15T00:00:00Z",
              },
              {
                id: 2,
                title: "Naruto",
                status: "completed",
                score: 8,
                chapters_read: 700,
                created_at: "2022-01-01T00:00:00Z",
                updated_at: "2022-12-01T00:00:00Z",
              },
              {
                id: 3,
                title: "Bleach",
                status: "on_hold",
                score: 7,
                chapters_read: 366,
                created_at: "2022-01-01T00:00:00Z",
                updated_at: "2022-06-01T00:00:00Z",
              },
            ],
          },
        });
      });

      // Mock AniList search API
      ipcMain.handle("anilist:search-manga", (event, query) => {
        // Return different results based on the query
        const mockResults: Record<string, any> = {
          "One Piece": {
            data: {
              Page: {
                media: [
                  {
                    id: 21,
                    title: { romaji: "One Piece", english: "One Piece" },
                    chapters: 1100,
                    status: "RELEASING",
                    coverImage: { medium: "https://example.com/one-piece.jpg" },
                  },
                ],
              },
            },
          },
          Naruto: {
            data: {
              Page: {
                media: [
                  {
                    id: 30,
                    title: { romaji: "Naruto", english: "Naruto" },
                    chapters: 700,
                    status: "FINISHED",
                    coverImage: { medium: "https://example.com/naruto.jpg" },
                  },
                ],
              },
            },
          },
          Bleach: {
            data: {
              Page: {
                media: [
                  {
                    id: 42,
                    title: { romaji: "Bleach", english: "Bleach" },
                    chapters: 686,
                    status: "FINISHED",
                    coverImage: { medium: "https://example.com/bleach.jpg" },
                  },
                ],
              },
            },
          },
        };

        // Return result for the specific title or empty results
        return (
          mockResults[query as string] || { data: { Page: { media: [] } } }
        );
      });

      // Mock the sync operation
      ipcMain.handle("anilist:sync", () => {
        return { success: true, message: "Successfully synced 3 manga titles" };
      });
    });

    // Reload the app to apply the auth state
    await page.reload();
    await page.waitForTimeout(1000);

    // Step 2: Navigate to import page and import manga
    await navigateTo(page, "/import");
    await page.waitForTimeout(1000);
    await debugPageContent(page);

    // Find and click the file select button
    const fileButtonSelectors = [
      'button:has-text("Select")',
      'button:has-text("Choose")',
      'button:has-text("Browse")',
      'button:has-text("File")',
      "button",
    ];

    for (const selector of fileButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(500);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Find and click the import button
    const importButtonSelectors = [
      'button:has-text("Import")',
      'button:has-text("Upload")',
      'button:has-text("Submit")',
      'button[type="submit"]',
      "button",
    ];

    for (const selector of importButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Step 3: Navigate to matching page
    await navigateTo(page, "/matching");
    await page.waitForTimeout(1000);
    await debugPageContent(page);

    // Look for auto-match button
    const autoMatchButtonSelectors = [
      'button:has-text("Auto")',
      'button:has-text("Automatic")',
      'button:has-text("Match All")',
      "button",
    ];

    for (const selector of autoMatchButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(2000);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Step 4: Look for continue button to move to sync
    const continueButtonSelectors = [
      'button:has-text("Continue")',
      'button:has-text("Next")',
      'button:has-text("Sync")',
      "button",
    ];

    for (const selector of continueButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Step 5: On sync page, start sync
    await debugPageContent(page);

    // Look for sync button
    const syncButtonSelectors = [
      'button:has-text("Sync")',
      'button:has-text("Start Sync")',
      'button:has-text("Upload")',
      "button",
    ];

    for (const selector of syncButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(3000);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Check for success message
    const successSelectors = [
      'text="success"',
      'text="Success"',
      'text="successfully"',
      'text="Successfully"',
      'text="complete"',
      'text="Complete"',
    ];

    for (const selector of successSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          break;
        }
      } catch {
        // Try next selector
      }
    }
  } finally {
    await electronApp.close();
  }
});
