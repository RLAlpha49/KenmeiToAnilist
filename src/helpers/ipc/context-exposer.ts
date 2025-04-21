/**
 * @packageDocumentation
 * @module context_exposer
 * @description Exposes all IPC context bridges for the Electron renderer process, including window, theme, auth, store, and API contexts.
 */

import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeAuthContext } from "./auth/auth-context";
import { exposeStoreContext } from "./store/store-context";
import { exposeApiContext } from "./api/api-context";

/**
 * Exposes all IPC context bridges for the Electron renderer process.
 *
 * @source
 */
export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeAuthContext();
  exposeStoreContext();
  exposeApiContext();
}
