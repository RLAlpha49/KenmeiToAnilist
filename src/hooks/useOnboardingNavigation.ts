import { useOnboarding } from "@/contexts/OnboardingContext";
import { getRouteForStep } from "@/config/onboarding-routes";
import { useEffect, useRef } from "react";
import { router, history } from "@/routes/router";
import { getPathname } from "@/utils/getPathname";

/**
 * Hook that automatically navigates to the correct page for the current onboarding step.
 * Includes debouncing to prevent navigation loops, in-flight tracking to prevent duplicate navigations,
 * and router readiness checks to ensure route state is stable.
 */
export function useOnboardingNavigation() {
  const { isActive, currentStep } = useOnboarding();
  const routerInstance = router;
  const lastRouteRef = useRef<string | null>(null);
  const navigationInFlightRef = useRef(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip if onboarding is not active
    if (!isActive) return;

    // Don't queue a new navigation if one is already in flight
    if (navigationInFlightRef.current) {
      return;
    }

    const targetRoute = getRouteForStep(currentStep);

    // Get current location using the memory history API
    const currentPath = getPathname(history.location);

    // Skip if target route is same as current route to prevent loops
    if (lastRouteRef.current === targetRoute || currentPath === targetRoute) {
      return;
    }

    // Mark this route as last navigated to prevent loops
    lastRouteRef.current = targetRoute;

    // Mark navigation as in-flight to prevent duplicate navigation during async transition
    navigationInFlightRef.current = true;

    // Add slight delay to allow overlay animation to complete and ensure router is ready
    navigationTimeoutRef.current = setTimeout(() => {
      // Verify router is still active and we're still on the same step
      if (!isActive) {
        navigationInFlightRef.current = false;
        return;
      }

      // Re-check current path at navigation time (route may have changed)
      const currentPathAtNav = getPathname(history.location);

      // Only navigate if target differs from current location
      if (currentPathAtNav !== targetRoute && targetRoute !== "/") {
        routerInstance
          .navigate({ to: targetRoute as never })
          .catch(() => {
            // Navigation failed or was cancelled, allow next navigation attempt
          })
          .finally(() => {
            navigationInFlightRef.current = false;
          });
      } else if (targetRoute === "/" && currentPathAtNav !== "/") {
        routerInstance
          .navigate({ to: "/" as never })
          .catch(() => {
            // Navigation failed or was cancelled, allow next navigation attempt
          })
          .finally(() => {
            navigationInFlightRef.current = false;
          });
      } else {
        // No navigation needed, reset flag
        navigationInFlightRef.current = false;
      }
    }, 250); // Increased delay to 250ms for better router readiness

    return () => {
      // Clear navigation timeout on unmount or step change
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      // Reset in-flight flag on unmount
      navigationInFlightRef.current = false;
    };
  }, [isActive, currentStep]);
}
