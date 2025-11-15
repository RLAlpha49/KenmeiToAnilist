/**
 * @packageDocumentation
 * @module store-setup
 * @description Registers IPC event listeners for interacting with the Electron store (get, set, remove, clear) in the main process.
 */

import { BrowserWindow } from "electron";
import { secureHandle } from "../listeners-register";
import Store from "electron-store";

/**
 * Schema for the Electron store.
 * @property authState - Authentication state.
 * @property useCustomCredentials - Flag indicating custom credentials are enabled.
 * @property customCredentials - Serialized custom credentials.
 * @property theme - User theme preference.
 * @source
 */
interface StoreSchema {
  authState: string;
  useCustomCredentials: string;
  customCredentials: string;
  theme: string;
}

/**
 * Interface for electron-store methods.
 * @source
 */
interface ElectronStoreInterface {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  clear(): void;
}

/** Persistent store instance for application data. @source */
const store = new Store<StoreSchema>() as unknown as ElectronStoreInterface;

/**
 * Registers IPC handlers for store operations: get, set, remove, and clear.
 * @param mainWindow - Main application window for security validation.
 * @source
 */
export function setupStoreIPC(mainWindow: BrowserWindow) {
  // store:getItem - Retrieve value by key
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

  // store:setItem - Store key-value pair
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

  // store:removeItem - Delete value by key
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

  // store:clear - Remove all stored values
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
