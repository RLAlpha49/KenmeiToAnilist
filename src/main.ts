/**
 * @packageDocumentation
 * @module main
 * @description Electron main process entry point.
 * Handles window creation, security configuration, Sentry initialization, update checking,
 * Windows installer events (Squirrel), and preload/environment setup for the renderer process.
 * @source
 */

/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, session } from "electron";
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

/**
 * Initialize error tracking and configuration.
 * Performs Sentry initialization, auto-updater setup, and store initialization.
 * All initialization logs are grouped for better console output organization.
 * @source
 */
startGroup(`[Main] App Initialization v${app.getVersion()}`);
console.info(
  `[Main] 🚀 Initializing app v${app.getVersion()} in ${process.env.NODE_ENV || "production"} mode`,
);

/**
 * Initialize Sentry error tracking in production environments only.
 * Captures unhandled errors and sends them to Sentry for monitoring.
 * @source
 */
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

/**
 * Configure auto-updater with GitHub releases feed.
 * Sets up automatic update checking and installation behavior.
 * @source
 */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.logger = console;

// Configure feed URL for GitHub releases
autoUpdater.setFeedURL({
  provider: "github",
  owner: "RLAlpha49",
  repo: "KenmeiToAnilist",
});

/**
 * Set up auto-updater event listeners for logging and error handling.
 * @source
 */
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
  // Report update errors to Sentry for visibility
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

/**
 * Initialize electron-store for persistent cross-process preferences.
 * Uses a typed facade to avoid `any` and maintain type safety.
 * @source
 */
const store = new Store() as unknown as {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

/**
 * Restore persisted auto-updater preferences from storage.
 * Sets `allowPrerelease` based on the stored update channel preference.
 * @source
 */
try {
  const savedChannel = (store.get("update_channel") as string) || "stable";
  autoUpdater.allowPrerelease = savedChannel === "beta";
  console.debug(
    `[Main] 🔍 Auto-updater initialized allowPrerelease=${autoUpdater.allowPrerelease}`,
  );
} catch (err) {
  console.debug("[Main] 🔍 Could not read update_channel from store:", err);
}

/**
 * Configures Content Security Policy headers for all web requests.
 * Complements the CSP meta tag in index.html with additional security.
 * In development (app not packaged), relaxes connect-src to allow WebSocket and Vite dev server.
 * @remarks Called during app initialization to set up security headers.
 * @source
 */
function configureSecurityHeaders() {
  return withGroup(`[Main] Configure Security Headers`, () => {
    console.info("[Main] 🔒 Setting up Content Security Policy headers...");

    // Determine if we're in development mode
    const isDevMode = !app.isPackaged;

    // Set CSP headers for all requests
    // Reference: docs/guides/SECURITY.md for CSP policy source of truth
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      // Build CSP directives based on environment
      const connectSrcDirectives = isDevMode
        ? "connect-src 'self' https://graphql.anilist.co https://api.mangadex.org https://api.comick.fun https://api.github.com ws: http://localhost:*;"
        : "connect-src 'self' https://graphql.anilist.co https://api.mangadex.org https://api.comick.fun https://api.github.com;";

      // Allow inline scripts in development (Vite HMR injects small inline scripts).
      // Production remains strict (no 'unsafe-inline').
      const scriptSrcDirective = isDevMode
        ? "script-src 'self' 'unsafe-inline';"
        : "script-src 'self';";

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self';",
            scriptSrcDirective,
            "style-src 'self' 'unsafe-inline';",
            "img-src 'self' data: https:;",
            "font-src 'self' data:;",
            connectSrcDirectives,
            "object-src 'none';",
            "base-uri 'self';",
            "form-action 'none';",
            "frame-ancestors 'none';",
            "upgrade-insecure-requests;",
          ].join(" "),
        },
      });
    });

    if (isDevMode) {
      console.info(
        "[Main] ℹ️ CSP configured in development mode (WebSocket + Vite dev server allowed)",
      );
    } else {
      console.info("[Main] ✅ CSP headers configured for production");
    }
  });
}

/**
 * Configures permission handlers to deny all external permission requests.
 * Prevents the app from requesting camera, microphone, geolocation, etc.
 * @remarks Called during app initialization before windows are created.
 * @source
 */
function configurePermissionHandlers() {
  return withGroup(`[Main] Configure Permission Handlers`, () => {
    console.info("[Main] 🔒 Setting up permission handlers...");

    // Deny all permission requests (camera, microphone, geolocation, etc.)
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        console.warn(
          `[Main] ⚠️ Permission request denied: ${permission} from ${webContents.getURL()}`,
        );
        callback(false); // Deny all permissions
      },
    );

    // Additional permission check handler for finer control
    session.defaultSession.setPermissionCheckHandler(() => false);

    console.info("[Main] ✅ Permission handlers configured");
  });
}

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

/** Indicates if the application is running in development mode. @source */
const inDevelopment = process.env.NODE_ENV === "development";

/**
 * Indicates if developer tools should be enabled.
 * Set via ENABLE_DEVTOOLS environment variable ("1" or "true").
 * @source
 */
const enableDevTools =
  process.env.ENABLE_DEVTOOLS === "1" || process.env.ENABLE_DEVTOOLS === "true";

// Make app version available to the renderer process via environment variable
process.env.VITE_APP_VERSION = app.getVersion();

/** Splash screen window instance. @source */
let splashWindow: BrowserWindow | null = null;

/**
 * Resolves the assets directory path.
 * In development, loads from src/assets; in production, loads from bundled resources.
 * @returns Absolute path to the assets directory.
 * @source
 */
const getAssetsPath = () =>
  inDevelopment
    ? path.join(__dirname, "../../src/assets")
    : path.join(process.resourcesPath, "assets");

/**
 * Creates and displays a splash screen window during application startup.
 * The splash screen is frameless, always-on-top, and transparent with a loading animation.
 * @returns Void (splash window stored in module-level variable).
 * @remarks The splash screen is closed by closeSplashScreen() when the main window is ready.
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
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const splashPath = path.join(getAssetsPath(), "splash.html");

    console.debug(`[Main] 🔍 Loading splash from: ${splashPath}`);
    splashWindow.loadFile(splashPath);
    splashWindow.center();

    // Handle splash loading errors
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
 * Closes and destroys the splash screen window.
 * Safely checks if the window exists and hasn't already been destroyed.
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
 * Creates the main application window.
 * Sets up the BrowserWindow, registers IPC listeners, handles content loading,
 * and manages the transition from splash screen to main window.
 * @returns Void (main window is managed by Electron).
 * @remarks Handles both development (Vite dev server) and production (bundled) loading modes.
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
        sandbox: true,
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

    // Load content from dev server (development) or bundled file (production)
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

      // Configure security before creating windows
      // In production (app.isPackaged), configure full CSP headers
      // In development, CSP is still applied but allows WebSocket and Vite dev server
      configureSecurityHeaders();
      configurePermissionHandlers();

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

/**
 * Handle macOS-specific behavior for window-all-closed event.
 * On macOS, applications typically remain active even with all windows closed,
 * allowing the user to reopen windows via the dock or menu.
 * On other platforms, closing all windows quits the application.
 * @source
 */
app.on("window-all-closed", () => {
  console.info("[Main] 🪟 All windows closed");
  if (process.platform !== "darwin") {
    console.info("[Main] 👋 Quitting app (non-macOS)");
    app.quit();
  }
});

/**
 * Handle macOS-specific activate event.
 * On macOS, the activate event fires when the dock icon is clicked or the app is activated.
 * If no windows are open, this recreates the main window(s).
 * @source
 */
app.on("activate", () => {
  console.debug("[Main] 🔍 App activated");
  if (BrowserWindow.getAllWindows().length === 0) {
    console.info("[Main] 🪟 No windows open, creating new window");
    createSplashScreen();
    createWindow();
  }
});

/**
 * Export public functions for use in other modules or tests.
 * These functions are the main entry points for window and extension management.
 * @source
 */
export {
  createWindow,
  createSplashScreen,
  closeSplashScreen,
  installExtensions,
  configureSecurityHeaders,
  configurePermissionHandlers,
};
