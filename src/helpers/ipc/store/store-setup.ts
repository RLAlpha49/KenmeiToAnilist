import { ipcMain } from "electron";
import Store from "electron-store";

// Define a schema for type safety (optional but recommended)
interface StoreSchema {
  authState: string;
  useCustomCredentials: string;
  customCredentials: string;
  theme: string;
}

// Create store instance
const store = new Store<StoreSchema>();

export function setupStoreIPC() {
  // Handle getting an item from the store
  ipcMain.handle("store:getItem", (_, key: string) => {
    try {
      return store.get(key, null);
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
