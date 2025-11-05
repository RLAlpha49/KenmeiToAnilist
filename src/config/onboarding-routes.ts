import type { OnboardingStep } from "@/contexts/OnboardingContext";
import type { ElementSpotlight } from "@/components/onboarding/OnboardingHighlight";

/**
 * Configuration for a single onboarding step: route, spotlight element, and description.
 * @source
 */
export interface StepRouteConfig {
  step: OnboardingStep;
  route: string;
  spotlight?: ElementSpotlight;
  description: string;
}

/**
 * Maps onboarding steps to their routes, spotlight elements, and descriptions.
 * @source
 */
export const STEP_ROUTE_CONFIG: StepRouteConfig[] = [
  {
    step: "welcome",
    route: "/",
    spotlight: undefined,
    description: "Welcome screen on home page - no specific element",
  },
  {
    step: "import",
    route: "/import",
    spotlight: {
      selector: '[data-onboarding="file-input"]',
      padding: 12,
      borderRadius: 8,
    },
    description: "Highlight CSV file input on import page",
  },
  {
    step: "auth",
    route: "/settings",
    spotlight: {
      selector: '[data-onboarding="auth-button"]',
      padding: 12,
      borderRadius: 8,
    },
    description: "Highlight AniList login button on settings page",
  },
  {
    step: "matching",
    route: "/review",
    spotlight: {
      selector: '[data-onboarding="match-list"]',
      padding: 12,
      borderRadius: 8,
    },
    description: "Highlight match review list on matching page",
  },
  {
    step: "settings",
    route: "/settings",
    spotlight: {
      selector: '[data-onboarding="sync-tab"]',
      padding: 12,
      borderRadius: 8,
    },
    description:
      "Highlight sync tab first, then switch to sync settings after click",
  },
  {
    step: "sync",
    route: "/sync",
    spotlight: {
      selector: '[data-onboarding="sync-button"]',
      padding: 12,
      borderRadius: 8,
    },
    description: "Highlight sync execute button on sync page",
  },
  {
    step: "complete",
    route: "/",
    spotlight: undefined,
    description: "Completion screen on home page",
  },
];

/**
 * Gets the route for a specific onboarding step.
 * @param step - The onboarding step.
 * @returns The route path for the step.
 * @source
 */
export function getRouteForStep(step: OnboardingStep): string {
  const config = STEP_ROUTE_CONFIG.find((c) => c.step === step);
  return config?.route ?? "/";
}

/**
 * Gets the spotlight element config for a specific onboarding step.
 * @param step - The onboarding step.
 * @returns The spotlight config, or undefined if no element should be highlighted.
 * @source
 */
export function getSpotlightForStep(
  step: OnboardingStep,
): ElementSpotlight | undefined {
  const config = STEP_ROUTE_CONFIG.find((c) => c.step === step);
  return config?.spotlight;
}
