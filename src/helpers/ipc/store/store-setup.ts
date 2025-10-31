/**
 * @packageDocumentation
 * @module store_setup
 * @description Registers IPC event listeners for interacting with the Electron store (get, set, remove, clear) in the main process.
 */

import { BrowserWindow } from "electron";
import { secureHandle } from "../listeners-register";
import Store from "electron-store";

/**
 * Schema for the Electron store, defining the available keys and their types.
 *
 * @property authState - The authentication state.
 * @property useCustomCredentials - Whether custom credentials are used.
 * @property customCredentials - The custom credentials string.
 * @property theme - The theme preference string.
 * @source
 */
interface StoreSchema {
  authState: string;
  useCustomCredentials: string;
  customCredentials: string;
  theme: string;
}

/**
 * Interface for electron-store methods to avoid any types
 */
interface ElectronStoreInterface {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  clear(): void;
}

// Create store instance
const store = new Store<StoreSchema>() as unknown as ElectronStoreInterface;

/**
 * Registers IPC event listeners for interacting with the Electron store (get, set, remove, clear).
 *
 * @param mainWindow - The main application window for security validation
 * @source
 */
export function setupStoreIPC(mainWindow: BrowserWindow) {
  // Handle getting an item from the store
  secureHandle(
    "store:getItem",
    (_event: Electron.IpcMainInvokeEvent, key: string) => {
      try {
        return store.get(key) || null;
      } catch (error) {
        console.error(`Error getting item from store: ${key}`, error);
        return null;
      }
    },
    mainWindow,
  );

  // Handle setting an item in the store
  secureHandle(
    "store:setItem",
    (_event: Electron.IpcMainInvokeEvent, key: string, value: string) => {
      try {
        store.set(key, value);
        return true;
      } catch (error) {
        console.error(`Error setting item in store: ${key}`, error);
        return false;
      }
    },
    mainWindow,
  );

  // Handle removing an item from the store
  secureHandle(
    "store:removeItem",
    (_event: Electron.IpcMainInvokeEvent, key: string) => {
      try {
        store.delete(key);
        return true;
      } catch (error) {
        console.error(`Error removing item from store: ${key}`, error);
        return false;
      }
    },
    mainWindow,
  );

  // Handle clearing the store
  secureHandle(
    "store:clear",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      try {
        store.clear();
        return true;
      } catch (error) {
        console.error("Error clearing store", error);
        return false;
      }
    },
    mainWindow,
  );
}
