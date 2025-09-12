/**
 * @packageDocumentation
 * @module store_setup
 * @description Registers IPC event listeners for interacting with the Electron store (get, set, remove, clear) in the main process.
 */

import { ipcMain } from "electron";
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
 * @source
 */
export function setupStoreIPC() {
  // Handle getting an item from the store
  ipcMain.handle("store:getItem", (_, key: string) => {
    try {
      return store.get(key) || null;
    } catch (error) {
      console.error(`Error getting item from store: ${key}`, error);
      return null;
    }
  });

  // Handle setting an item in the store
  ipcMain.handle("store:setItem", (_, key: string, value: string) => {
    try {
      store.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item in store: ${key}`, error);
      return false;
    }
  });

  // Handle removing an item from the store
  ipcMain.handle("store:removeItem", (_, key: string) => {
    try {
      store.delete(key);
      return true;
    } catch (error) {
      console.error(`Error removing item from store: ${key}`, error);
      return false;
    }
  });

  // Handle clearing the store
  ipcMain.handle("store:clear", () => {
    try {
      store.clear();
      return true;
    } catch (error) {
      console.error("Error clearing store", error);
      return false;
    }
  });
}
