/**
 * @packageDocumentation
 * @module routes
 * @description Route definitions for the application using TanStack Router. Exports all main routes and the root route tree.
 */

import { createRoute } from "@tanstack/react-router";
import { RootRoute } from "./__root";
import { HomePage } from "../pages/HomePage";
import { ImportPage } from "../pages/ImportPage";
import { SettingsPage } from "../pages/SettingsPage";
import { MatchingPage } from "../pages/MatchingPage";
import { SyncPage } from "../pages/SyncPage";

// Steps to add a new route:
// 1. Create a new page component in the '../pages/' directory (e.g., NewPage.tsx)
// 2. Import the new page component at the top of this file
// 3. Define a new route for the page using createRoute()
// 4. Add the new route to the routeTree in RootRoute.addChildren([...])
// 5. Add a new Link in the navigation section of RootRoute if needed

// Example of adding a new route:
// 1. Create '../pages/NewPage.tsx'
// 2. Import: import { NewPage } from '../pages/NewPage';
// 3. Define route:
//    const NewRoute = createRoute({
//      getParentRoute: () => RootRoute,
//      path: '/new',
//      component: NewPage,
//    });
// 4. Add to routeTree: RootRoute.addChildren([HomeRoute, NewRoute, ...])
// 5. Add Link: <Link to="/new">New Page</Link>

/**
 * Route for the home page ('/').
 *
 * @source
 */
export const HomeRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage,
});

/**
 * Route for the import page ('/import').
 *
 * @source
 */
export const ImportRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/import",
  component: ImportPage,
});

/**
 * Route for the review/matching page ('/review').
 *
 * @source
 */
export const ReviewRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/review",
  component: MatchingPage,
});

/**
 * Route for the sync page ('/sync').
 *
 * @source
 */
export const SyncRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/sync",
  component: SyncPage,
});

/**
 * Route for the settings page ('/settings').
 *
 * @source
 */
export const SettingsRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/settings",
  component: SettingsPage,
});

/**
 * The root route tree containing all main application routes.
 *
 * @source
 */
export const rootTree = RootRoute.addChildren([
  HomeRoute,
  ImportRoute,
  ReviewRoute,
  SyncRoute,
  SettingsRoute,
]);
