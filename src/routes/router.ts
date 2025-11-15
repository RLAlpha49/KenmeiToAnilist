/**
 * @packageDocumentation
 * @module router
 * @description Application router configuration using TanStack Router, with memory history and route tree.
 */

import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { rootTree } from "./routes";

/**
 * The memory history instance for the router, initialized with the root path.
 *
 * @internal
 * @source
 */
export const history = createMemoryHistory({
  initialEntries: ["/"],
});

/**
 * The main application router instance, configured with the route tree and memory history.
 *
 * @source
 */
export const router = createRouter({ routeTree: rootTree, history: history });

/**
 * TypeScript declaration for the router instance, allowing type inference and autocompletion.
 *
 * @source
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
