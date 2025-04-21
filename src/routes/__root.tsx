/**
 * @packageDocumentation
 * @module root-route
 * @description Root route and layout for the application, providing the base layout and outlet for child routes.
 */

import React from "react";
import BaseLayout from "../components/layout/BaseLayout";
import { Outlet, createRootRoute } from "@tanstack/react-router";

/**
 * The root route for the application, providing the base layout and outlet for all child routes.
 *
 * @source
 */
export const RootRoute = createRootRoute({
  component: Root,
});

/**
 * The root layout component that wraps all pages with the base layout and renders the route outlet.
 *
 * @internal
 * @source
 */
export function Root() {
  return (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  );
}
