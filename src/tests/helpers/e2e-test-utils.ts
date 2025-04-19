import { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";
import * as fs from "fs";
import * as path from "path";

/**
 * Launches the Electron app and returns the app and window instances
 */
export async function launchElectronApp(timeout = 60000): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  let appInfo;
  let latestBuild;

  try {
    // Find the latest build of your application
    latestBuild = findLatestBuild();
    //console.log("Found build directory:", latestBuild);
    appInfo = parseElectronApp(latestBuild);
  } catch (error) {
    console.error("Error finding latest build:", error);

    // Fallback mechanism based on platform
    const platform = process.platform;
    //console.log("Attempting fallback for platform:", platform);

    // Create a manual appInfo object
    if (platform === "darwin") {
      // macOS fallback
      const possibleAppPaths = [
        "out/Kenmei-to-Anilist-darwin-x64/Kenmei-to-Anilist.app",
        "out/Kenmei-to-Anilist-darwin-arm64/Kenmei-to-Anilist.app",
        "out/make/Kenmei-to-Anilist.app",
        "out/Kenmei to Anilist.app",
        "out/make/zip/darwin/x64/Kenmei-to-Anilist-darwin-x64-3.0.0/Kenmei-to-Anilist.app",
        "out/make/zip/darwin/arm64/Kenmei-to-Anilist-darwin-arm64-3.0.0/Kenmei-to-Anilist.app",
      ];

      // Try to find any .app bundle in out directory if none of the specific paths work
      for (const appPath of possibleAppPaths) {
        if (fs.existsSync(appPath)) {
          //console.log(`Found app at ${appPath}`);
          const executable = `${appPath}/Contents/MacOS/Kenmei-to-Anilist`;
          if (fs.existsSync(executable)) {
            appInfo = {
              executable: executable,
              main: "",
            };
            break;
          } else {
            //console.log(
            //  `Found app bundle but executable not at expected path: ${executable}`,
            //);
            // Try to find any executable in the MacOS directory
            const macOsDir = `${appPath}/Contents/MacOS`;
            if (fs.existsSync(macOsDir)) {
              const files = fs.readdirSync(macOsDir);
              if (files.length > 0) {
                const execPath = path.join(macOsDir, files[0]);
                //console.log(`Found potential executable: ${execPath}`);
                appInfo = {
                  executable: execPath,
                  main: "",
                };
                break;
              }
            }
          }
        }
      }

      // Last resort: search for any .app in the out directory
      if (!appInfo) {
        //console.log("Searching for any .app bundle in out directory");
        let foundApp = false;
        if (fs.existsSync("out")) {
          const findAppBundle = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                if (entry.name.endsWith(".app")) {
                  //console.log(`Found .app bundle: ${fullPath}`);
                  // Look for executable in MacOS directory
                  const macOsDir = path.join(fullPath, "Contents", "MacOS");
                  if (fs.existsSync(macOsDir)) {
                    const files = fs.readdirSync(macOsDir);
                    if (files.length > 0) {
                      const execPath = path.join(macOsDir, files[0]);
                      //console.log(`Found executable: ${execPath}`);
                      appInfo = {
                        executable: execPath,
                        main: "",
                      };
                      foundApp = true;
                      return;
                    }
                  }
                } else if (!foundApp) {
                  // Recursively search subdirectories but not too deep
                  if (fullPath.split(path.sep).length < 10) {
                    findAppBundle(fullPath);
                  }
                }
              }
            }
          };
          try {
            findAppBundle("out");
          } catch (err) {
            console.error("Error searching for app bundle:", err);
          }
        }
      }
    } else if (platform === "win32") {
      // Windows fallback
      const possibleAppPaths = [
        "out/Kenmei-to-Anilist-win32-x64/Kenmei-to-Anilist.exe",
        "out/make/squirrel.windows/x64/Kenmei-to-Anilist-Setup.exe",
        "out/make/squirrel.windows/x64/Kenmei-to-Anilist.exe",
        "out/Kenmei-to-Anilist.exe",
      ];

      for (const appPath of possibleAppPaths) {
        if (fs.existsSync(appPath)) {
          //console.log(`Found app at ${appPath}`);
          appInfo = {
            executable: appPath,
            main: "",
          };
          break;
        }
      }

      // Last resort: search for any .exe in the out directory
      if (!appInfo) {
        //console.log("Searching for any .exe in out directory");
        let foundExe = false;
        if (fs.existsSync("out")) {
          const findExe = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isFile() && entry.name.endsWith(".exe")) {
                //console.log(`Found exe: ${fullPath}`);
                appInfo = {
                  executable: fullPath,
                  main: "",
                };
                foundExe = true;
                return;
              } else if (entry.isDirectory() && !foundExe) {
                // Recursively search subdirectories but not too deep
                if (fullPath.split(path.sep).length < 10) {
                  findExe(fullPath);
                }
              }
            }
          };
          try {
            findExe("out");
          } catch (err) {
            console.error("Error searching for exe:", err);
          }
        }
      }
    } else if (platform === "linux") {
      // Linux fallback
      const possibleAppPaths = [
        "out/Kenmei-to-Anilist-linux-x64/Kenmei-to-Anilist",
        "out/Kenmei to Anilist-linux-x64/Kenmei to Anilist",
        "out/Kenmei-to-Anilist-linux-x64/kenmei-to-anilist",
        "out/Kenmei to Anilist-linux-x64/kenmei-to-anilist",
        // Add electron executable paths
        "out/Kenmei to Anilist-linux-x64/electron",
        "out/Kenmei-to-Anilist-linux-x64/electron",
        // Try different capitalization
        "out/Kenmei to Anilist-linux-x64/Kenmei-to-Anilist",
        "out/Kenmei-to-Anilist-linux-x64/Kenmei to Anilist",
        // Try looking at main.js directly
        "out/Kenmei to Anilist-linux-x64/resources/app/.vite/build/main.js",
        "out/Kenmei-to-Anilist-linux-x64/resources/app/.vite/build/main.js",
        // More fallbacks
        "out/Kenmei-to-Anilist-linux-x64/usr/bin/kenmei-to-anilist",
        "out/make/deb/x64/kenmei-to-anilist_3.0.0_amd64.deb",
        "out/Kenmei-to-Anilist",
        "out/kenmei-to-anilist",
      ];

      // Try to find the app executable with more detailed logging
      for (const appPath of possibleAppPaths) {
        try {
          //console.log(`Checking if ${appPath} exists...`);
          if (fs.existsSync(appPath)) {
            //console.log(`Found app at ${appPath}`);
            // If it's a .deb file, we can't use it directly
            if (appPath.endsWith(".deb")) {
              //console.log(
              //  "Found .deb file but can't use it directly for E2E tests",
              //);
              continue;
            }

            // Verify the file is executable
            try {
              const stats = fs.statSync(appPath);
              const isExecutable = !!(stats.mode & 0o111);
              //console.log(`${appPath} executable permission: ${isExecutable}`);

              if (!isExecutable) {
                //console.log(
                //  `${appPath} exists but is not executable, attempting to make it executable`,
                //);
                try {
                  // Try to make the file executable
                  fs.chmodSync(appPath, 0o755);
                  //console.log(`Changed permissions for ${appPath}`);
                } catch (chmodErr) {
                  console.error(
                    `Failed to make ${appPath} executable:`,
                    chmodErr,
                  );
                }
              }
            } catch (statErr) {
              console.error(
                `Failed to check permissions for ${appPath}:`,
                statErr,
              );
            }

            appInfo = {
              executable: appPath,
              main: "",
            };
            break;
          }
        } catch (err) {
          console.error(`Error checking ${appPath}:`, err);
        }
      }

      // Last resort: search for any executable file in the out directory
      if (!appInfo) {
        //console.log("Searching for any executable in out directory");
        let foundExecutable = false;
        if (fs.existsSync("out")) {
          const findExecutable = (dir: string) => {
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                try {
                  const fullPath = path.join(dir, entry.name);
                  if (entry.isFile()) {
                    try {
                      // Check if file is executable (has execute permission)
                      const stats = fs.statSync(fullPath);
                      const isExecutable = !!(stats.mode & 0o111);
                      // Also check if it looks like an electron binary
                      const isLikelyElectron =
                        entry.name.toLowerCase().includes("electron") ||
                        entry.name.toLowerCase().includes("kenmei") ||
                        entry.name.toLowerCase().includes("anilist");

                      if (isExecutable || isLikelyElectron) {
                        //console.log(
                        //  `Found potential executable: ${fullPath} (executable: ${isExecutable}, likely electron: ${isLikelyElectron})`,
                        //);

                        // If it's not executable but looks like our app, try to make it executable
                        if (!isExecutable && isLikelyElectron) {
                          try {
                            fs.chmodSync(fullPath, 0o755);
                            //console.log(`Made ${fullPath} executable`);
                          } catch (chmodErr) {
                            console.error(
                              `Failed to make ${fullPath} executable:`,
                              chmodErr,
                            );
                          }
                        }

                        appInfo = {
                          executable: fullPath,
                          main: "",
                        };
                        foundExecutable = true;
                        return;
                      }
                    } catch (err) {
                      // Ignore errors checking file permissions
                      console.error(
                        `Error checking permissions for ${fullPath}:`,
                        err,
                      );
                    }
                  } else if (entry.isDirectory() && !foundExecutable) {
                    // Recursively search subdirectories but not too deep
                    if (fullPath.split(path.sep).length < 10) {
                      findExecutable(fullPath);
                      if (foundExecutable) return;
                    }
                  }
                } catch (entryErr) {
                  console.error(
                    `Error processing entry ${entry.name}:`,
                    entryErr,
                  );
                }
              }
            } catch (readErr) {
              console.error(`Error reading directory ${dir}:`, readErr);
            }
          };

          try {
            findExecutable("out");
          } catch (err) {
            console.error("Error searching for executable:", err);
          }
        }
      }
    }

    if (!appInfo) {
      // Print out directory structure for debugging
      console.error("Directory structure of out directory:");
      try {
        const listDir = (dir: string, indent = "") => {
          if (!fs.existsSync(dir)) {
            console.error(`${indent}Directory does not exist: ${dir}`);
            return;
          }
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              console.error(`${indent}${entry.name}/`);
              // Don't go too deep
              if (indent.length < 12) {
                listDir(fullPath, indent + "  ");
              } else {
                console.error(`${indent}  ...`);
              }
            } else {
              console.error(`${indent}${entry.name}`);
            }
          }
        };
        listDir("out");
      } catch (err) {
        console.error("Error listing directory structure:", err);
      }

      throw new Error(`Could not find app executable for platform ${platform}`);
    }
  }

  // Launch Electron app
  //console.log(`Attempting to launch Electron app with:
  //- executablePath: ${appInfo.executable}
  //- args: ${appInfo.main ? [appInfo.main] : []}
  //- timeout: ${timeout}
  //`);

  // Additional verification before launch
  try {
    const executableExists = fs.existsSync(appInfo.executable);
    //console.log(`Executable exists check: ${executableExists}`);

    if (executableExists) {
      //const stats = fs.statSync(appInfo.executable);
      //console.log(`Executable stats:
      //- size: ${stats.size} bytes
      //- permissions: ${stats.mode.toString(8)}
      //- is executable: ${!!(stats.mode & 0o111)}
      //`);
    }
  } catch (err) {
    console.error(`Error verifying executable before launch:`, err);
  }

  // Launch with try/catch to get more detailed error information
  let electronApp;
  try {
    // Configure launch options with platform-specific additions
    const launchOptions = {
      args: appInfo.main ? [appInfo.main] : [],
      executablePath: appInfo.executable,
      timeout,
    };

    // On Linux in CI, we need additional args to run headless
    if (process.platform === "linux") {
      //console.log("Adding Linux-specific electron launch args");

      // Handle spaces in paths - check if we need to escape the path
      if (appInfo.executable.includes(" ")) {
        //console.log("Path contains spaces, attempting to normalize path");
        try {
          const normalizedPath = path.normalize(appInfo.executable);
          //console.log(`Normalized path: ${normalizedPath}`);
          launchOptions.executablePath = normalizedPath;

          // If the main arg also has spaces, normalize it too
          if (appInfo.main && appInfo.main.includes(" ")) {
            const normalizedMainPath = path.normalize(appInfo.main);
            //console.log(`Normalized main path: ${normalizedMainPath}`);
            launchOptions.args = [normalizedMainPath];
          }
        } catch (normErr) {
          console.error(`Error normalizing paths: ${normErr}`);
        }
      }

      launchOptions.args = [
        ...(launchOptions.args || []),
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
      ];

      // Add CI environment detection
      if (process.env.CI) {
        //console.log("Running in CI environment, adding additional args");
        launchOptions.args.push("--headless");
      }
    }

    //console.log(
    //  `Final launch options: ${JSON.stringify(launchOptions, null, 2)}`,
    //);

    electronApp = await electron.launch(launchOptions);
  } catch (error) {
    console.error(`Failed to launch Electron app: ${error}`);

    if (process.platform === "linux") {
      //console.log(
      //  "Trying to make the executable executable one more time before failing",
      //);
      try {
        fs.chmodSync(appInfo.executable, 0o755);
        //console.log(`Changed permissions for ${appInfo.executable} to 755`);

        // Create launch options again for retry
        const retryLaunchOptions = {
          args: [
            ...(appInfo.main ? [appInfo.main] : []),
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
          executablePath: appInfo.executable,
          timeout,
        };

        // Try launching one more time
        try {
          electronApp = await electron.launch(retryLaunchOptions);
          //console.log("Second launch attempt succeeded!");
        } catch (secondError) {
          console.error(`Second launch attempt also failed: ${secondError}`);

          // Last resort: try with minimal configuration
          //console.log("Making one final attempt with minimal configuration");
          try {
            const minimalOptions = {
              executablePath: appInfo.executable,
              timeout,
              args: ["--no-sandbox", "--disable-gpu"],
            };
            electronApp = await electron.launch(minimalOptions);
            //console.log("Final attempt succeeded!");
          } catch (finalError) {
            console.error(
              `All launch attempts failed. Final error: ${finalError}`,
            );
            throw finalError;
          }
        }
      } catch (chmodErr) {
        console.error(`Failed to change permissions: ${chmodErr}`);
        throw error;
      }
    } else {
      throw error;
    }
  }

  // Get the first window
  const page = await electronApp.firstWindow();

  // Try different selectors to detect when the app is loaded
  const selectors = [
    'div[role="main"]',
    "main",
    "#root",
    ".app-container",
    'div[data-testid="app-container"]',
  ];

  let appDetected = false;
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      appDetected = true;
      break;
    } catch {
      // Continue to next selector
    }
  }

  // If we couldn't detect the app with any of the selectors, wait for the page to be stable
  if (!appDetected) {
    await page.waitForLoadState("networkidle", { timeout });
  }

  return { electronApp, page };
}

/**
 * Mock authentication by injecting auth data into localStorage
 */
export async function mockAuth(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      localStorage.setItem(
        "anilist_auth",
        JSON.stringify({
          accessToken: "mock-access-token",
          refreshToken: "mock-refresh-token",
          expiresAt: Date.now() + 3600 * 1000,
          tokenType: "Bearer",
          isAuthenticated: true,
        }),
      );
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw err;
  }
}

/**
 * Mock user profile data by setting up IPC handlers
 */
export async function mockUserProfile(
  electronApp: ElectronApplication,
): Promise<void> {
  try {
    await electronApp.evaluate(({ ipcMain }) => {
      // Mock user data
      ipcMain.handle("anilist:get-user", async () => {
        return {
          id: 123456,
          name: "TestUser",
          avatar: {
            large: "https://example.com/avatar.png",
          },
          medialistCounts: {
            manga: 0,
          },
        };
      });
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw err;
  }
}

/**
 * Navigate to a specific route in the app
 */
export async function navigateTo(page: Page, route: string): Promise<void> {
  try {
    // Method 1: Use page evaluation for hash navigation
    if (route.startsWith("/")) {
      await page.evaluate((r) => {
        window.location.hash = r;
      }, route);
    } else if (route.startsWith("#/")) {
      await page.evaluate((r) => {
        window.location.hash = r.substring(1); // Remove the # since we're setting hash directly
      }, route);
    } else {
      // For non-hash routes, try direct navigation
      await page.goto(route);
    }

    // Method 2: Click navigation link if available
    try {
      const navLinks = [
        `a[href="#${route}"]`,
        `a:has-text("${route.replace("/", "")}")`,
        `button:has-text("${route.replace("/", "")}")`,
        `[data-testid="${route.replace("/", "")}-link"]`,
      ];

      for (const selector of navLinks) {
        const link = await page.$(selector);
        if (link) {
          await link.click();
          break;
        }
      }
    } catch {
      // Navigation via click failed, continue with other methods
    }

    // Wait for content to load
    await page.waitForLoadState("networkidle");
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw err;
  }
}

/**
 * Helper to safely click on elements with multiple selector fallbacks
 */
export async function safeClick(
  page: Page,
  selectors: string[],
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        return true;
      }
    } catch {
      // Continue to next selector
    }
  }

  return false;
}

/**
 * Helper function to safely select an option using multiple selector fallbacks
 */
export async function safeSelectOption(
  page: Page,
  selectSelectors: string[],
  optionValue: string,
): Promise<boolean> {
  for (const selector of selectSelectors) {
    try {
      const selectElement = await page.$(selector);
      if (selectElement) {
        await page.selectOption(selector, optionValue);
        return true;
      }
    } catch {
      // Continue to next selector
    }
  }

  return false;
}

/**
 * Debug function to analyze page content for troubleshooting
 * Returns information about the page without logging to console
 */
export async function debugPageContent(page: Page): Promise<{
  url: string;
  title: string;
  structure: string;
  textContent: string;
}> {
  try {
    // Get all text content from the page
    const textContent = await page.evaluate(() => {
      return document.body.textContent || "";
    });

    // Get page title
    const title = await page.title();

    // Get current URL
    const url = page.url();

    // Get HTML structure (simplified)
    const htmlStructure = await page.evaluate(() => {
      const getNodePath = (
        element: Element,
        depth = 0,
        maxDepth = 3,
      ): string => {
        if (!element || depth > maxDepth) return "";

        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : "";
        const classes = Array.from(element.classList)
          .map((c) => `.${c}`)
          .join("");
        const children = Array.from(element.children)
          .map((child) => getNodePath(child, depth + 1, maxDepth))
          .filter(Boolean)
          .join("\n" + "  ".repeat(depth + 1));

        return `${"  ".repeat(depth)}${tag}${id}${classes}${children ? "\n" + children : ""}`;
      };

      return getNodePath(document.body);
    });

    // Return the data without logging
    return {
      url,
      title,
      structure: htmlStructure,
      textContent:
        textContent.substring(0, 500) + (textContent.length > 500 ? "..." : ""),
    };
  } catch (error) {
    // Return empty data on error
    return {
      url: "",
      title: "",
      structure: "",
      textContent: `Error analyzing page: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Verify localStorage has expected values
 */
export async function verifyLocalStorage(
  page: Page,
  key: string,
  expectedValueCheck: (value: any) => boolean,
): Promise<boolean> {
  try {
    return await page.evaluate(
      ({ storageKey, check }) => {
        const item = localStorage.getItem(storageKey);
        if (!item) return false;

        try {
          const value = JSON.parse(item);
          // We can't pass the function directly, so we use a string representation of the check
          return eval(check)(value);
        } catch {
          return false;
        }
      },
      {
        storageKey: key,
        // Convert the function to string for evaluation in page context
        check: expectedValueCheck.toString(),
      },
    );
  } catch {
    return false;
  }
}
