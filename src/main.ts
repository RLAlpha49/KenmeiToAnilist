/**
 * @packageDocumentation
 * @module main
 * @description Electron main process entry point. Handles window creation, Sentry initialization, Windows installer events, and environment setup for the renderer process.
 */

/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, ipcMain } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import squirrelStartup from "electron-squirrel-startup";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import Store from "electron-store";
import * as Sentry from "@sentry/electron/main";
import "dotenv/config";
import {
  withGroup,
  withGroupAsync,
  startGroup,
  endGroup,
} from "./utils/logging";
import { autoUpdater } from "electron-updater";

// --- Sentry Initialization ---
startGroup(`[Main] App Initialization v${app.getVersion()}`);
console.info(
  `[Main] 🚀 Initializing app v${app.getVersion()} in ${process.env.NODE_ENV || "production"} mode`,
);

// Initialize Sentry only in production with a valid DSN
const sentryDsn = process.env.SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";
if (sentryDsn && isProduction) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    release: app.getVersion(),
  });
  console.debug("[Main] 🔍 Sentry initialized");
} else if (isProduction) {
  console.debug("[Main] 🔍 Sentry DSN not configured, skipping initialization");
} else {
  console.debug(
    "[Main] 🔍 Sentry disabled in non-production environment (NODE_ENV !== production)",
  );
}

// --- Auto-Updater Configuration ---
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.logger = console;

// Configure feed URL for GitHub releases
autoUpdater.setFeedURL({
  provider: "github",
  owner: "RLAlpha49",
  repo: "KenmeiToAnilist",
});

// Set up auto-updater event listeners for logging
autoUpdater.on("checking-for-update", () => {
  if (!isProduction) {
    console.info("[Auto-Updater] 🔍 Checking for updates...");
  }
});

autoUpdater.on("update-available", (info) => {
  if (!isProduction) {
    console.info(`[Auto-Updater] ✅ Update available: v${info.version}`);
  }
});

autoUpdater.on("update-not-available", (info) => {
  if (!isProduction) {
    console.info(
      `[Auto-Updater] ℹ️ No updates available (current: v${info.version})`,
    );
  }
});

autoUpdater.on("error", (error) => {
  console.error("[Auto-Updater] ❌ Update error:", error);
  // Report update errors to Sentry
  Sentry.captureException(error, {
    tags: {
      component: "auto-updater",
    },
  });
});

if (!isProduction) {
  console.debug("[Main] 🔍 Auto-updater configured");
}
endGroup();
// --- End Sentry Initialization ---

// Initialize electron-store for storing cross-process preferences
// Provide a narrow typed facade so we avoid using `any` and satisfy eslint/typechecks
const store = new Store() as unknown as {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

// Ensure auto-updater respects persisted preference at startup
try {
  const savedChannel = (store.get("update_channel") as string) || "stable";
  autoUpdater.allowPrerelease = savedChannel === "beta";
  console.debug(
    `[Main] 🔍 Auto-updater initialized allowPrerelease=${autoUpdater.allowPrerelease}`,
  );
} catch (err) {
  console.debug("[Main] 🔍 Could not read update_channel from store:", err);
}

// IPC: allow renderer to update the chosen update channel immediately
ipcMain.handle("updates:set-channel", (_event, channel: "stable" | "beta") => {
  try {
    store.set("update_channel", channel);
    autoUpdater.allowPrerelease = channel === "beta";
    console.info(
      `[Main] ✅ Update channel set to ${channel} (allowPrerelease=${autoUpdater.allowPrerelease})`,
    );
    return { success: true };
  } catch (err) {
    console.error("[Main] ❌ Failed to set update channel:", err);
    return { success: false, error: String(err) };
  }
});

// Handle Windows Squirrel events
if (process.platform === "win32") {
  const squirrelCommand = process.argv[1];

  /**
   * Handles Windows Squirrel installer events and creates/removes shortcuts.
   * @returns True if a Squirrel event was handled and the app should quit.
   * @source
   */
  const handleSquirrelEvent = (): boolean => {
    return withGroup(`[Main] Squirrel Event: ${squirrelCommand}`, () => {
      if (process.argv.length === 1) {
        return false;
      }

      const appFolder = path.resolve(process.execPath, "..");
      const rootAtomFolder = path.resolve(appFolder, "..");
      const updateDotExe = path.resolve(
        path.join(rootAtomFolder, "Update.exe"),
      );
      const exeName = path.basename(process.execPath);

      switch (squirrelCommand) {
        case "--squirrel-install":
        case "--squirrel-updated":
          console.info(
            `[Main] 📦 Handling Squirrel ${squirrelCommand === "--squirrel-install" ? "install" : "update"} event`,
          );
          // Always create desktop and start menu shortcuts
          app.setAppUserModelId("com.rlapps.kenmeitoanilist");

          // We run this synchronously to ensure everything is properly created before quitting
          spawnSync(updateDotExe, [
            "--createShortcut",
            exeName,
            "--shortcut-locations",
            "Desktop,StartMenu",
          ]);

          console.info("[Main] ✅ Shortcuts created successfully");
          return true;
        case "--squirrel-uninstall":
          console.info("[Main] 🗑️ Handling Squirrel uninstall event");
          // Remove shortcuts
          spawnSync(updateDotExe, ["--removeShortcut", exeName]);

          console.info("[Main] ✅ Shortcuts removed successfully");
          return true;
        case "--squirrel-obsolete":
          console.debug("[Main] 🔍 Handling Squirrel obsolete event");
          return true;
      }
      return false;
    });
  };

  // If we handled a squirrel event, quit this instance and let the installer handle it
  if (handleSquirrelEvent()) {
    app.quit();
  }
}

// Handle general startup
if (squirrelStartup) {
  app.quit();
}

const inDevelopment = process.env.NODE_ENV === "development";
const enableDevTools =
  process.env.ENABLE_DEVTOOLS === "1" || process.env.ENABLE_DEVTOOLS === "true";

// Make app version available to the renderer process
process.env.VITE_APP_VERSION = app.getVersion();

let splashWindow: BrowserWindow | null = null;

const getAssetsPath = () =>
  inDevelopment
    ? path.join(__dirname, "../../src/assets")
    : path.join(process.resourcesPath, "assets");

/**
 * Creates a splash screen window displayed during app startup.
 * @remarks Frameless, always-on-top window with loading animation.
 * @source
 */
function createSplashScreen() {
  return withGroup(`[Main] Create Splash Screen`, () => {
    console.info("[Main] 🎨 Creating splash screen...");
    splashWindow = new BrowserWindow({
      width: 500,
      height: 400,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const splashPath = path.join(getAssetsPath(), "splash.html");

    console.debug(`[Main] 🔍 Loading splash from: ${splashPath}`);
    splashWindow.loadFile(splashPath);
    splashWindow.center();

    splashWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDesc) => {
        console.error(
          `[Main] ❌ Failed to load splash screen (${errorCode}): ${errorDesc}`,
        );
      },
    );

    console.info("[Main] ✅ Splash screen created");
  });
}

/**
 * Closes the splash screen window.
 * @source
 */
function closeSplashScreen() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    console.info("[Main] 🎨 Closing splash screen");
    splashWindow.close();
    splashWindow = null;
  }
}

/**
 * Creates the main application window and registers IPC listeners.
 * @remarks Loads preload script, initializes window, and handles content loading.
 * @source
 */
function createWindow() {
  return withGroup(`[Main] Create Main Window`, () => {
    console.info("[Main] 🪟 Creating main application window...");
    const preload = path.join(__dirname, "preload.js");
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false, // Don't show until ready
      webPreferences: {
        devTools: inDevelopment || enableDevTools,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        preload: preload,
      },
      titleBarStyle: "hidden",
    });

    console.debug("[Main] 🔍 Registering IPC listeners...");
    registerListeners(mainWindow);

    // Track if content loaded successfully
    let contentLoaded = false;

    // Handle successful load
    mainWindow.webContents.on("did-finish-load", () => {
      console.info("[Main] ✅ Main window content loaded successfully");
      contentLoaded = true;
    });

    // Handle load failures
    mainWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          `[Main] ❌ Main window failed to load (${errorCode}): ${errorDescription}`,
        );
        console.error(`[Main] ❌ Failed URL: ${validatedURL}`);
        contentLoaded = false;
      },
    );

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      console.debug(
        `[Main] 🔍 Loading dev server: ${MAIN_WINDOW_VITE_DEV_SERVER_URL}`,
      );
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      const filePath = path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
      );
      console.debug(`[Main] 🔍 Loading file: ${filePath}`);
      console.debug(`[Main] 🔍 __dirname: ${__dirname}`);
      console.debug(
        `[Main] 🔍 MAIN_WINDOW_VITE_NAME: ${MAIN_WINDOW_VITE_NAME}`,
      );
      console.debug(`[Main] 🔍 app.isPackaged: ${app.isPackaged}`);
      console.debug(
        `[Main] 🔍 process.resourcesPath: ${process.resourcesPath}`,
      );
      mainWindow.loadFile(filePath).catch((err) => {
        console.error(`[Main] ❌ Failed to load main window file:`, err);
      });
    }

    // Auto-open DevTools if explicitly enabled via env var
    if (enableDevTools) {
      console.info("[Main] 🔧 DevTools enabled via ENABLE_DEVTOOLS env var");
      mainWindow.webContents.openDevTools({ mode: "right" });
    }

    // Show main window and close splash when ready
    mainWindow.once("ready-to-show", () => {
      console.info("[Main] ✅ Main window ready-to-show event fired");

      // Add a small delay to ensure smooth transition
      setTimeout(() => {
        if (contentLoaded) {
          closeSplashScreen();
          mainWindow.show();
          console.info("[Main] ✅ Main window displayed");
        } else {
          console.error(
            "[Main] ❌ Main window content not loaded, keeping splash visible",
          );
        }
      }, 1500);
    });

    console.info("[Main] ✅ Main window created successfully");
  });
}

/**
 * Installs development extensions (e.g., React Developer Tools).
 * @returns Promise that resolves when extensions are installed, or no-op if dev tools not enabled.
 * @remarks Only runs when inDevelopment is true or enableDevTools is set via environment.
 * @source
 */
async function installExtensions() {
  // Gate behind dev-only or explicit opt-in
  if (!inDevelopment && !enableDevTools) {
    console.debug(
      "[Main] 🔍 Dev tools not enabled, skipping extension installation",
    );
    return;
  }

  return withGroupAsync(`[Main] Install Extensions`, async () => {
    try {
      const result = await installExtension(REACT_DEVELOPER_TOOLS);
      console.info(
        `[Main] ✅ Extensions installed successfully: ${result.name}`,
      );
    } catch (error) {
      console.error("[Main] ❌ Failed to install extensions:", error);
    }
  });
}

app
  .whenReady()
  .then(() => {
    return withGroupAsync(`[Main] App Startup Sequence`, async () => {
      console.info("[Main] ✅ App ready event received");
      createSplashScreen();
      return createWindow();
    });
  })
  .then(installExtensions)
  .then(() => {
    // Schedule initial update check after 10 seconds to avoid blocking startup
    setTimeout(() => {
      withGroupAsync(`[Main] Initial Update Check`, async () => {
        try {
          console.info("[Main] 🔍 Performing initial update check...");
          await autoUpdater.checkForUpdates();
        } catch (error) {
          // Silently ignore update check errors in dev/non-packaged environments
          // In production, these are already logged by the autoUpdater error handler
          if (process.env.NODE_ENV === "production" && app.isPackaged) {
            console.error("[Main] ❌ Initial update check failed:", error);
          } else {
            console.debug(
              "[Main] 🔍 Update check failed (non-packaged environment):",
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      });
    }, 10000);

    // Set up periodic update checks every 4 hours
    setInterval(
      () => {
        withGroupAsync(`[Main] Periodic Update Check`, async () => {
          try {
            console.info("[Main] 🔍 Performing periodic update check...");
            await autoUpdater.checkForUpdates();
          } catch (error) {
            // Silently ignore periodic update check errors
            if (process.env.NODE_ENV === "production" && app.isPackaged) {
              console.error("[Main] ❌ Periodic update check failed:", error);
            } else {
              console.debug(
                "[Main] 🔍 Periodic update check failed (non-packaged):",
                error instanceof Error ? error.message : String(error),
              );
            }
          }
        });
      },
      4 * 60 * 60 * 1000,
    );
  });

//osX only
app.on("window-all-closed", () => {
  console.info("[Main] 🪟 All windows closed");
  if (process.platform !== "darwin") {
    console.info("[Main] 👋 Quitting app (non-macOS)");
    app.quit();
  }
});

app.on("activate", () => {
  console.debug("[Main] 🔍 App activated");
  if (BrowserWindow.getAllWindows().length === 0) {
    console.info("[Main] 🪟 No windows open, creating new window");
    createSplashScreen();
    createWindow();
  }
});
//osX only ends

export {
  createWindow,
  createSplashScreen,
  closeSplashScreen,
  installExtensions,
};
