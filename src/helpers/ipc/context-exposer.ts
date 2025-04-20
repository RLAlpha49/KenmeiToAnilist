import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeAuthContext } from "./auth/auth-context";
import { exposeStoreContext } from "./store/store-context";
import { exposeApiContext } from "./api/api-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeAuthContext();
  exposeStoreContext();
  exposeApiContext();
}
