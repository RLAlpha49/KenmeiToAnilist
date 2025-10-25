/**
 * @deprecated Use `OnboardingOverlay` and `OnboardingContext` instead.
 * This component is maintained for backwards compatibility only.
 * The new onboarding system provides a non-blocking overlay experience
 * that guides users through the actual app workflow.
 *
 * See: src/components/onboarding/OnboardingOverlay.tsx
 * See: src/contexts/OnboardingContext.tsx
 */

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setOnboardingCompleted } from "@/utils/storage";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface StepConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  gradient: string;
}

function renderButtonContent(
  currentStep: number,
  totalSteps: number,
  isCompleting: boolean,
) {
  if (isCompleting) {
    return (
      <>
        <div className="border-background border-t-foreground mr-2 h-4 w-4 animate-spin rounded-full border-2" />
        {currentStep === totalSteps ? "Completing..." : "Loading..."}
      </>
    );
  }
  if (currentStep === totalSteps) {
    return (
      <>
        <Check className="mr-1 h-4 w-4" />
        Complete
      </>
    );
  }
  return (
    <>
      Next
      <ChevronRight className="ml-1 h-4 w-4" />
    </>
  );
}

export function OnboardingWizard({
  onComplete,
  onSkip,
}: Readonly<OnboardingWizardProps>) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showEscapeConfirmDialog, setShowEscapeConfirmDialog] = useState(false);

  const steps: StepConfig[] = [
    {
      title: "Welcome to Kenmei to AniList",
      description: "Your personal manga library migration assistant",
      icon: <Sparkles className="h-8 w-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-foreground/80 text-sm">
            This wizard will guide you through the process of migrating your
            manga library from Kenmei to AniList in just a few steps.
          </p>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              Here&apos;s what you&apos;ll do:
            </h4>
            <ul className="text-foreground/80 space-y-1 text-sm">
              <li className="flex gap-2">
                <span>1.</span>
                <span>Import your manga data from a Kenmei CSV export</span>
              </li>
              <li className="flex gap-2">
                <span>2.</span>
                <span>Connect your AniList account securely</span>
              </li>
              <li className="flex gap-2">
                <span>3.</span>
                <span>Match your manga across both platforms</span>
              </li>
              <li className="flex gap-2">
                <span>4.</span>
                <span>Configure sync preferences and settings</span>
              </li>
              <li className="flex gap-2">
                <span>5.</span>
                <span>Start syncing your library</span>
              </li>
            </ul>
          </div>
          <p className="text-foreground/70 text-sm italic">
            You can skip this wizard at any time, but we recommend completing it
            for the best experience.
          </p>
        </div>
      ),
      gradient:
        "bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-blue-500/5",
    },
    {
      title: "Import Your Manga Data",
      description: "Start with a CSV export from Kenmei",
      icon: <Upload className="h-8 w-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-foreground/80 text-sm">
            First, export your manga library from Kenmei as a CSV file. This
            file contains all your manga titles, reading progress, and personal
            ratings.
          </p>
          <div className="bg-secondary/50 space-y-3 rounded-lg p-4">
            <h4 className="text-sm font-semibold">
              How to export from Kenmei:
            </h4>
            <ol className="text-foreground/80 list-inside list-decimal space-y-2 text-sm">
              <li>Open Kenmei in your browser</li>
              <li>Navigate to your library settings</li>
              <li>Select &quot;Export Library&quot;</li>
              <li>Choose CSV format</li>
              <li>Download your file</li>
            </ol>
          </div>
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
            <p className="text-foreground/80 text-sm">
              <strong>Privacy Note:</strong> Your CSV file is processed locally
              on your computer. No data is sent to external servers during the
              import process.
            </p>
          </div>
        </div>
      ),
      gradient:
        "bg-gradient-to-br from-green-500/15 via-emerald-500/10 to-green-500/5",
    },
    {
      title: "Connect Your AniList Account",
      description: "Secure OAuth connection to AniList",
      icon: <Search className="h-8 w-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-foreground/80 text-sm">
            Next, you&apos;ll authenticate with your AniList account using
            OAuth. This allows the application to sync your manga data securely.
          </p>
          <div className="bg-secondary/50 space-y-3 rounded-lg p-4">
            <h4 className="text-sm font-semibold">
              What happens during login:
            </h4>
            <ul className="text-foreground/80 list-inside list-disc space-y-2 text-sm">
              <li>
                You&apos;ll be redirected to AniList&apos;s secure login page
              </li>
              <li>You&apos;ll grant this app permission to manage your list</li>
              <li>Your authentication token is stored securely locally</li>
              <li>You can revoke access anytime from your AniList settings</li>
            </ul>
          </div>
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
            <p className="text-foreground/80 text-sm">
              <strong>Security:</strong> Your password is never shared with this
              application. AniList uses industry-standard OAuth 2.0
              authentication.
            </p>
          </div>
        </div>
      ),
      gradient:
        "bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-purple-500/5",
    },
    {
      title: "Match Your Manga",
      description: "Intelligent matching between libraries",
      icon: <RefreshCw className="h-8 w-8" />,
      content: (
        <TooltipProvider>
          <div className="space-y-4">
            <p className="text-foreground/80 text-sm">
              The application uses advanced algorithms to automatically match
              your Kenmei manga with entries on AniList.
            </p>
            <div className="bg-secondary/50 space-y-3 rounded-lg p-4">
              <h4 className="text-sm font-semibold">Matching process:</h4>
              <ul className="text-foreground/80 space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Automatic matching using title and metadata</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500">✓</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">
                        Confidence scoring system
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        Shows how confident the match is (High, Medium, Low)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Manual search and override options</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Skip matches you don&apos;t want to sync</span>
                </li>
              </ul>
            </div>
            <p className="text-foreground/70 text-sm">
              You&apos;ll be able to review and adjust matches before syncing.
            </p>
          </div>
        </TooltipProvider>
      ),
      gradient:
        "bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-orange-500/5",
    },
    {
      title: "Sync Configuration",
      description: "Set your preferences and safety features",
      icon: <Settings className="h-8 w-8" />,
      content: (
        <TooltipProvider>
          <div className="space-y-4">
            <p className="text-foreground/80 text-sm">
              Configure how your data will be synchronized with AniList. Choose
              your preferred settings and safety options.
            </p>
            <div className="bg-secondary/50 space-y-3 rounded-lg p-4">
              <h4 className="text-sm font-semibold">Available options:</h4>
              <ul className="text-foreground/80 space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-blue-500">◆</span>
                  <span>Choose what data to sync (scores, dates, status)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">◆</span>
                  <span>Set priority conflicts resolution</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">◆</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">
                        Enable incremental sync
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        Only sync changes instead of full library refresh
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">◆</span>
                  <span>Dry-run mode to preview changes</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
              <p className="text-foreground/80 text-sm">
                <strong>Ready to go!</strong> After configuration, you&apos;ll
                be set up to start syncing your library.
              </p>
            </div>
          </div>
        </TooltipProvider>
      ),
      gradient:
        "bg-gradient-to-br from-cyan-500/15 via-teal-500/10 to-cyan-500/5",
    },
  ];

  const handleNext = useCallback(async () => {
    if (currentStep === steps.length) {
      await handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, steps.length]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }, []);

  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      setOnboardingCompleted(true);
      onComplete();
    } finally {
      setIsCompleting(false);
    }
  }, [onComplete]);

  const handleSkip = useCallback(async () => {
    setIsCompleting(true);
    try {
      setOnboardingCompleted(true);
      onSkip();
    } finally {
      setIsCompleting(false);
    }
  }, [onSkip]);

  const handleRestartTour = useCallback(() => {
    setCurrentStep(1);
  }, []);

  // Handle keyboard navigation (Enter to advance, Escape to show confirmation)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCompleting) return;

      if (event.key === "Enter") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setShowEscapeConfirmDialog(true);
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleNext, isCompleting]);

  const step = steps[currentStep - 1];

  return (
    <>
      {/* Escape confirmation dialog */}
      <AlertDialog
        open={showEscapeConfirmDialog}
        onOpenChange={setShowEscapeConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Skip Onboarding?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to skip the onboarding wizard? You can restart
            it later from the home page.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEscapeConfirmDialog(false);
                handleSkip();
              }}
            >
              Skip
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-primary">{step.icon}</div>
                <div>
                  <DialogTitle className="text-xl">{step.title}</DialogTitle>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                disabled={isCompleting}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1 pt-2">
              {steps.map((_, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep - 1;
                let bgClass = "bg-muted";
                if (isCurrent) {
                  bgClass = "bg-primary/70";
                } else if (isCompleted) {
                  bgClass = "bg-primary";
                }
                return (
                  <div
                    key={`step-${index + 1}`}
                    className={`h-1 flex-1 rounded-full transition-colors ${bgClass}`}
                  />
                );
              })}
            </div>
          </DialogHeader>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={`border-0 ${step.gradient}`}>
                <CardHeader>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">{step.content}</CardContent>
                <CardFooter className="flex justify-between pt-4">
                  <div className="text-muted-foreground text-xs">
                    Step {currentStep} of {steps.length}
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          </AnimatePresence>

          <DialogFooter className="flex justify-between gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isCompleting}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={isCompleting}
              >
                Skip
              </Button>
            </div>
            <Button
              onClick={handleNext}
              disabled={isCompleting}
              className="bg-primary hover:bg-primary/90"
            >
              {renderButtonContent(currentStep, steps.length, isCompleting)}
            </Button>
          </DialogFooter>

          {currentStep === steps.length && (
            <div className="mt-2 text-center">
              <Button
                variant="link"
                size="sm"
                onClick={handleRestartTour}
                disabled={isCompleting}
                className="text-xs"
              >
                ↻ Restart Tour
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
