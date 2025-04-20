import { contextBridge, ipcRenderer } from "electron";

export function exposeStoreContext() {
  contextBridge.exposeInMainWorld("electronStore", {
    getItem: (key: string) => ipcRenderer.invoke("store:getItem", key),
    setItem: (key: string, value: string) =>
      ipcRenderer.invoke("store:setItem", key, value),
    removeItem: (key: string) => ipcRenderer.invoke("store:removeItem", key),
    clear: () => ipcRenderer.invoke("store:clear"),
  });
}
