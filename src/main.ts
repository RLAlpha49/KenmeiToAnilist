import { app, BrowserWindow } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import squirrelStartup from "electron-squirrel-startup";
import path from "path";
import { spawnSync } from "child_process";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import * as Sentry from "@sentry/electron/main";
import "dotenv/config";

// --- Sentry Initialization ---
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV,
  release: app.getVersion(),
});
// --- End Sentry Initialization ---

// Handle Windows Squirrel events
if (process.platform === "win32") {
  const squirrelCommand = process.argv[1];

  // Check if we're running under Windows installer setup
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
        // Always create desktop and start menu shortcuts
        app.setAppUserModelId("com.rlapps.kenmeitoanilist");

        // We run this synchronously to ensure everything is properly created before quitting
        spawnSync(updateDotExe, [
          "--createShortcut",
          exeName,
          "--shortcut-locations",
          "Desktop,StartMenu",
        ]);

        return true;
      case "--squirrel-uninstall":
        // Remove shortcuts
        spawnSync(updateDotExe, ["--removeShortcut", exeName]);

        return true;
      case "--squirrel-obsolete":
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

function createWindow() {
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
  registerListeners(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

app.whenReady().then(createWindow).then(installExtensions);

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
