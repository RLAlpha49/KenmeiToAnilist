import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Upload,
  Search,
  RefreshCw,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOnboarding, STEP_CONFIGS } from "@/contexts/OnboardingContext";
import { useOnboardingNavigation } from "@/hooks/useOnboardingNavigation";
import { OnboardingHighlight } from "@/components/onboarding/OnboardingHighlight";
import { getSpotlightForStep } from "@/config/onboarding-routes";
import type { OnboardingStep } from "@/contexts/OnboardingContext";

const STEP_ICONS: Record<OnboardingStep, React.ReactNode> = {
  welcome: <Sparkles className="h-5 w-5" />,
  import: <Upload className="h-5 w-5" />,
  auth: <Search className="h-5 w-5" />,
  matching: <RefreshCw className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
  sync: <RefreshCw className="h-5 w-5" />,
  complete: <Check className="h-5 w-5" />,
};

interface OnboardingOverlayProps {
  position?:
    | "bottom-right"
    | "bottom-left"
    | "top-right"
    | "top-left"
    | "center";
  showProgress?: boolean;
}

export function OnboardingOverlay({
  position = "bottom-right",
  showProgress = true,
}: Readonly<OnboardingOverlayProps>) {
  const {
    isActive,
    currentStep,
    nextStep,
    previousStep,
    dismissOnboarding,
    finishOnboarding,
  } = useOnboarding();
  const [showSkipConfirmDialog, setShowSkipConfirmDialog] = useState(false);

  // Auto-navigate to the correct page for this step
  useOnboardingNavigation();

  const stepConfig = STEP_CONFIGS[currentStep];
  const isLastStep = currentStep === "complete";
  const isWelcomeStep = currentStep === "welcome";
  const spotlight = getSpotlightForStep(currentStep);

  const positionClasses: Record<string, string> = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    center: "inset-0 flex items-center justify-center",
  };

  const handleNext = () => {
    if (isLastStep) {
      finishOnboarding();
    } else {
      nextStep();
    }
  };

  const handleSkip = () => {
    setShowSkipConfirmDialog(true);
  };

  const handleConfirmSkip = () => {
    setShowSkipConfirmDialog(false);
    dismissOnboarding();
  };

  const stepIndex = Object.keys(STEP_CONFIGS).indexOf(currentStep);
  const totalSteps = Object.keys(STEP_CONFIGS).length;

  // Animation variants
  const containerVariants = {
    initial: { opacity: 0, scale: 0.9, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: 20 },
  };

  const contentVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { delay: 0.1 } },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <>
      {/* Skip confirmation dialog */}
      <AlertDialog
        open={showSkipConfirmDialog}
        onOpenChange={setShowSkipConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Skip Onboarding?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to skip the onboarding? You can restart it
            later from the home page.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSkip}>
              Skip
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Element highlighting spotlight */}
      {isActive && (
        <OnboardingHighlight
          isActive={isActive}
          spotlight={spotlight}
          onActionComplete={nextStep}
        />
      )}

      {/* Overlay card */}
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.div
            key={currentStep}
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`fixed ${positionClasses[position]} ${
              position === "center" ? "z-60 max-w-md" : "z-60 max-w-sm"
            } pointer-events-auto`}
            aria-label="Onboarding guide"
            aria-modal="false"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-description"
          >
            <motion.div
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="border-border bg-background rounded-lg border shadow-xl"
            >
              {/* Screen reader announcements */}
              <div
                id="onboarding-live-region"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                Step {stepIndex + 1} of {totalSteps}: {stepConfig.title}
              </div>
              {/* Header */}
              <div className="border-border flex items-start justify-between gap-4 border-b p-4">
                <div className="flex flex-1 items-start gap-3">
                  <motion.div
                    className="text-primary mt-1"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  >
                    {STEP_ICONS[currentStep]}
                  </motion.div>
                  <div>
                    <h3
                      id="onboarding-title"
                      className="text-base font-semibold"
                    >
                      {stepConfig.title}
                    </h3>
                    <p
                      id="onboarding-description"
                      className="text-muted-foreground text-xs"
                    >
                      {stepConfig.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={dismissOnboarding}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress indicator */}
              {showProgress && (
                <div className="flex gap-1 px-4 pt-3">
                  {Object.keys(STEP_CONFIGS).map((stepName, index) => {
                    const isCompleted = index < stepIndex;
                    const isCurrent = index === stepIndex;
                    let bgClass = "bg-muted";
                    if (isCurrent) {
                      bgClass = "bg-primary/70";
                    } else if (isCompleted) {
                      bgClass = "bg-primary";
                    }
                    return (
                      <motion.div
                        key={stepName}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        className={`h-0.5 flex-1 rounded-full transition-colors ${bgClass}`}
                        style={{ originX: 0 }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Content */}
              <div className="min-h-20 p-4">
                <motion.p
                  variants={contentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-foreground/80 text-sm leading-relaxed"
                >
                  {stepConfig.instructions}
                </motion.p>
              </div>

              {/* Footer */}
              <div className="border-border flex items-center justify-between gap-2 border-t p-4">
                <motion.div
                  className="text-muted-foreground text-xs font-medium"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                >
                  {stepIndex + 1} / {totalSteps}
                </motion.div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousStep}
                    disabled={isWelcomeStep}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="text-xs"
                  >
                    Skip
                  </Button>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={handleNext}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 gap-1"
                    >
                      {isLastStep ? (
                        <>
                          <Check className="h-3 w-3" />
                          Finish
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
