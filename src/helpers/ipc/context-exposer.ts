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
import { exposeUpdateContext } from "./update/update-context";
import { exposeBackupContext } from "./backup/backup-context";

/**
 * Exposes all IPC context bridges for the renderer process.
 * Registers window, theme, auth, store, API, update, and backup contexts with error handling.
 * @source
 */
export default function exposeContexts() {
  try {
    exposeWindowContext();
    console.log("[Context] ✅ Window context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose window context:", error);
  }

  try {
    exposeThemeContext();
    console.log("[Context] ✅ Theme context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose theme context:", error);
  }

  try {
    exposeAuthContext();
    console.log("[Context] ✅ Auth context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose auth context:", error);
  }

  try {
    exposeStoreContext();
    console.log("[Context] ✅ Store context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose store context:", error);
  }

  try {
    exposeApiContext();
    console.log("[Context] ✅ API context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose API context:", error);
  }

  try {
    exposeUpdateContext();
    console.log("[Context] ✅ Update context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose update context:", error);
  }

  try {
    exposeBackupContext();
    console.log("[Context] ✅ Backup context exposed");
  } catch (error) {
    console.error("[Context] ❌ Failed to expose backup context:", error);
  }
}
