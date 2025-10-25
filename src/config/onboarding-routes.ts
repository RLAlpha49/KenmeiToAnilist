import type { OnboardingStep } from "@/contexts/OnboardingContext";
import type { ElementSpotlight } from "@/components/onboarding/OnboardingHighlight";

export interface StepRouteConfig {
  step: OnboardingStep;
  route: string;
  spotlight?: ElementSpotlight;
  description: string;
}

/**
 * Maps each onboarding step to:
 * - The route/page where that step should take place
 * - The element to highlight on that page
 * - A description for debugging
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

export function getRouteForStep(step: OnboardingStep): string {
  const config = STEP_ROUTE_CONFIG.find((c) => c.step === step);
  return config?.route ?? "/";
}

export function getSpotlightForStep(
  step: OnboardingStep,
): ElementSpotlight | undefined {
  const config = STEP_ROUTE_CONFIG.find((c) => c.step === step);
  return config?.spotlight;
}
