import { BrowserWindow } from "electron";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { addAuthEventListeners } from "./auth/auth-listeners";
import { setupStoreIPC } from "./store/store-setup";
import { setupAniListAPI } from "./api/api-listeners";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addAuthEventListeners(mainWindow);
  setupStoreIPC();
  setupAniListAPI();
}
