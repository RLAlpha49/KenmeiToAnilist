/**
 * @packageDocumentation
 * @module main
 * @description Electron main process entry point. Handles window creation, Sentry initialization, Windows installer events, and environment setup for the renderer process.
 */

/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import squirrelStartup from "electron-squirrel-startup";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import * as Sentry from "@sentry/electron/main";
import "dotenv/config";

// --- Sentry Initialization ---
console.info(
  `[Main] 🚀 Initializing app v${app.getVersion()} in ${process.env.NODE_ENV || "production"} mode`,
);
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV,
  release: app.getVersion(),
});
console.debug("[Main] 🔍 Sentry initialized");
// --- End Sentry Initialization ---

// Handle Windows Squirrel events
if (process.platform === "win32") {
  const squirrelCommand = process.argv[1];

  /**
   * Handles Windows Squirrel installer events (install, update, uninstall, obsolete).
   *
   * @returns True if a Squirrel event was handled and the app should quit, false otherwise.
   * @remarks
   * This function is only relevant on Windows platforms when using Squirrel for installation.
   */
  const handleSquirrelEvent = () => {
    if (process.argv.length === 1) {
      return false;
    }

    const appFolder = path.resolve(process.execPath, "..");
    const rootAtomFolder = path.resolve(appFolder, "..");
    const updateDotExe = path.resolve(path.join(rootAtomFolder, "Update.exe"));
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

// Make app version available to the renderer process
process.env.VITE_APP_VERSION = app.getVersion();

/**
 * Creates the main application window and registers IPC listeners.
 *
 * @remarks
 * Sets up the preload script, window options, and loads the appropriate URL or file depending on environment.
 */
function createWindow() {
  console.info("[Main] 🪟 Creating main application window...");
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      preload: preload,
    },
    titleBarStyle: "hidden",
  });

  console.debug("[Main] 🔍 Registering IPC listeners...");
  registerListeners(mainWindow);

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
    mainWindow.loadFile(filePath);
  }

  console.info("[Main] ✅ Main window created successfully");
}

/**
 * Installs development extensions (e.g., React Developer Tools) in development mode.
 *
 * @returns A promise that resolves when extensions are installed.
 * @remarks
 * Only runs in development mode. Logs errors to the console if installation fails.
 */
async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.info(`[Main] Extensions installed successfully: ${result.name}`);
  } catch (error) {
    console.error("[Main] Failed to install extensions:", error);
  }
}

app
  .whenReady()
  .then(() => {
    console.info("[Main] ✅ App ready event received");
    return createWindow();
  })
  .then(installExtensions);

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
    createWindow();
  }
});
//osX only ends

export { createWindow, installExtensions };
