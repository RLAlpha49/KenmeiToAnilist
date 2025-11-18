import {
  useOnboarding,
  type OnboardingStep,
} from "@/contexts/onboarding-context";

/**
 * Hook for tracking and controlling onboarding progress for a specific step.
 * @param step - The onboarding step to track.
 * @returns Object with step state and completion control.
 * @source
 */
export function useOnboardingStep(step: OnboardingStep) {
  const { isActive, currentStep, isStepActive, completeStep } = useOnboarding();

  const isCurrentStep = isStepActive(step) && isActive;

  /**
   * Call this when the user has completed the action for this step.
   * @source
   */
  const markStepComplete = () => {
    completeStep(step);
  };

  return {
    isCurrentStep,
    isStepActive: currentStep === step,
    completeStep: markStepComplete,
  };
}
