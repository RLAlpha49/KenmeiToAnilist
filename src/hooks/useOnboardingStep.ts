import {
  useOnboarding,
  type OnboardingStep,
} from "@/contexts/OnboardingContext";

export function useOnboardingStep(step: OnboardingStep) {
  const { isActive, currentStep, isStepActive, completeStep } = useOnboarding();

  const isCurrentStep = isStepActive(step) && isActive;

  /**
   * Call this when the user has completed the action for this step
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
