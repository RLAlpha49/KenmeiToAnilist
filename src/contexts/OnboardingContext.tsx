import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { storage, STORAGE_KEYS } from "@/utils/storage";

export type OnboardingStep =
  | "welcome"
  | "import"
  | "auth"
  | "matching"
  | "settings"
  | "sync"
  | "complete";

export interface OnboardingStepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  instructions: string;
  icon: string;
  optional?: boolean;
}

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "import",
  "auth",
  "matching",
  "settings",
  "sync",
  "complete",
];

export const STEP_CONFIGS: Record<OnboardingStep, OnboardingStepConfig> = {
  welcome: {
    id: "welcome",
    title: "Welcome to Kenmei to AniList",
    description: "Your personal manga library migration assistant",
    instructions:
      "This wizard will guide you through the process of migrating your manga library from Kenmei to AniList. Click 'Next' when ready!",
    icon: "Sparkles",
  },
  import: {
    id: "import",
    title: "Import Your Manga Data",
    description: "Start with a CSV export from Kenmei",
    instructions:
      "Upload your Kenmei CSV export file. This file contains all your manga titles, reading progress, and personal ratings.",
    icon: "Upload",
  },
  auth: {
    id: "auth",
    title: "Connect Your AniList Account",
    description: "Secure OAuth connection to AniList",
    instructions:
      "Click the login button to authenticate with your AniList account. Your credentials are never shared with this application.",
    icon: "Search",
  },
  matching: {
    id: "matching",
    title: "Review Your Matches",
    description: "Intelligent matching between libraries",
    instructions:
      "Review and approve/reject the automatic matches between your Kenmei manga and AniList entries. You can manually search and override any matches.",
    icon: "RefreshCw",
  },
  settings: {
    id: "settings",
    title: "Configure Sync Settings",
    description: "Set your preferences and safety features",
    instructions:
      "Choose which data to sync (scores, dates, status) and set your sync preferences. These settings will apply to all your synced entries.",
    icon: "Settings",
    optional: true,
  },
  sync: {
    id: "sync",
    title: "Synchronize Your Library",
    description: "Push your curated list to AniList",
    instructions:
      "Review the entries to sync and click 'Sync' to push your approved matches to AniList. You can always undo this from your AniList account.",
    icon: "RefreshCw",
  },
  complete: {
    id: "complete",
    title: "Onboarding Complete!",
    description: "Your library is now synced with AniList",
    instructions:
      "Congratulations! Your manga library has been successfully migrated. You can now manage your library from both Kenmei and AniList.",
    icon: "Check",
  },
};

interface OnboardingContextType {
  isActive: boolean;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  stepProgress: Record<OnboardingStep, boolean>;

  // Actions
  startOnboarding: () => void;
  completeStep: (step: OnboardingStep) => void;
  skipStep: (step: OnboardingStep) => void;
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  finishOnboarding: () => void;
  resetOnboarding: () => void;
  dismissOnboarding: () => void;

  // Queries
  isStepCompleted: (step: OnboardingStep) => boolean;
  isStepActive: (step: OnboardingStep) => boolean;
  getStepProgress: () => number;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

export function OnboardingProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const initializationRef = useRef(false);

  /**
   * Parses a storage value to a strict boolean.
   * Only the exact string "true" is considered true; all other values are false.
   * @param value - The storage value to parse
   * @returns A strict boolean
   */
  const parseStrictBoolean = (value: string | null): boolean => {
    return value === "true";
  };

  /**
   * Filters completed steps to only include valid steps from STEP_ORDER.
   * Prevents migration issues from storage key changes.
   * @param steps - The steps to filter
   * @returns Filtered steps that exist in STEP_ORDER
   */
  const filterValidSteps = (steps: OnboardingStep[]): OnboardingStep[] => {
    return steps.filter((step) => STEP_ORDER.includes(step));
  };

  /**
   * Processes loaded steps and sets up initial state.
   * Extracts complexity from initialization effect.
   * @param stepsStr - The stringified completed steps
   */
  const processLoadedSteps = (stepsStr: string | null): void => {
    if (!stepsStr) {
      // Default to empty array if key is missing
      setCompletedSteps([]);
      setCurrentStep("welcome");
      return;
    }

    try {
      const parsed = JSON.parse(stepsStr);
      // Validate that parsed value is an array before use
      if (Array.isArray(parsed)) {
        const validSteps = filterValidSteps(parsed);
        setCompletedSteps(validSteps);

        // Find next incomplete step
        const nextStep = STEP_ORDER.find((step) => !validSteps.includes(step));
        if (nextStep) {
          setCurrentStep(nextStep);
        }
      } else {
        console.debug(
          "[OnboardingContext] Parsed steps is not an array, resetting",
        );
        setCompletedSteps([]);
        setCurrentStep("welcome");
      }
    } catch {
      // Reset if parsing fails
      console.debug(
        "[OnboardingContext] Failed to parse completed steps, resetting",
      );
      setCompletedSteps([]);
      setCurrentStep("welcome");
    }
  };

  // Initialize onboarding state from storage (runs once)
  useEffect(() => {
    if (initializationRef.current) return; // Skip if already initialized
    initializationRef.current = true;

    const initializeOnboarding = async () => {
      try {
        const completed = await storage.getItemAsync(
          STORAGE_KEYS.ONBOARDING_COMPLETED,
        );
        const completedStepsStr = await storage.getItemAsync(
          STORAGE_KEYS.ONBOARDING_STEPS_COMPLETED,
        );

        // Use strict boolean parsing
        if (!parseStrictBoolean(completed)) {
          setIsActive(true);
          processLoadedSteps(completedStepsStr);
        }
      } catch (error) {
        console.error("[OnboardingContext] Error initializing:", error);
      }
    };

    void initializeOnboarding();
  }, []);

  const completeStep = useCallback((step: OnboardingStep) => {
    setCompletedSteps((prev) => {
      const updated = Array.from(new Set([...prev, step]));
      // Persist to storage asynchronously
      storage
        .setItemAsync(
          STORAGE_KEYS.ONBOARDING_STEPS_COMPLETED,
          JSON.stringify(updated),
        )
        .catch((error) => {
          console.error(
            "[OnboardingContext] Failed to persist completed steps:",
            error,
          );
        });
      return updated;
    });
  }, []);

  const skipStep = useCallback(
    (step: OnboardingStep) => {
      // Skipping a step also marks it as completed so we can move forward
      completeStep(step);
    },
    [completeStep],
  );

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
  }, []);

  const nextStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
    }
  }, [currentStep]);

  const startOnboarding = useCallback(() => {
    setIsActive(true);
    setCurrentStep("welcome");
  }, []);

  const finishOnboarding = useCallback(() => {
    // Mark all steps as completed
    storage
      .setItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED, "true")
      .catch((error) => {
        console.error(
          "[OnboardingContext] Failed to persist onboarding completion:",
          error,
        );
      });
    storage
      .setItemAsync(
        STORAGE_KEYS.ONBOARDING_STEPS_COMPLETED,
        JSON.stringify(STEP_ORDER),
      )
      .catch((error) => {
        console.error(
          "[OnboardingContext] Failed to persist completed steps:",
          error,
        );
      });
    setIsActive(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    storage
      .setItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED, "false")
      .catch((error) => {
        console.error("[OnboardingContext] Failed to reset onboarding:", error);
      });
    storage
      .setItemAsync(STORAGE_KEYS.ONBOARDING_STEPS_COMPLETED, "[]")
      .catch((error) => {
        console.error(
          "[OnboardingContext] Failed to reset completed steps:",
          error,
        );
      });
    setCompletedSteps([]);
    setCurrentStep("welcome");
    setIsActive(true);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setIsActive(false);
    // Still mark as completed so it doesn't show again unless explicitly reset
    storage
      .setItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED, "true")
      .catch((error) => {
        console.error(
          "[OnboardingContext] Failed to dismiss onboarding:",
          error,
        );
      });
  }, []);

  const isStepCompleted = useCallback(
    (step: OnboardingStep) => completedSteps.includes(step),
    [completedSteps],
  );

  const isStepActive = useCallback(
    (step: OnboardingStep) => currentStep === step,
    [currentStep],
  );

  const getStepProgress = useCallback(() => {
    return Math.round((completedSteps.length / STEP_ORDER.length) * 100);
  }, [completedSteps]);

  const stepProgress = STEP_ORDER.reduce(
    (acc, step) => {
      acc[step] = completedSteps.includes(step);
      return acc;
    },
    {} as Record<OnboardingStep, boolean>,
  );

  const value: OnboardingContextType = useMemo(
    () => ({
      isActive,
      currentStep,
      completedSteps,
      stepProgress,
      startOnboarding,
      completeStep,
      skipStep,
      goToStep,
      nextStep,
      previousStep,
      finishOnboarding,
      resetOnboarding,
      dismissOnboarding,
      isStepCompleted,
      isStepActive,
      getStepProgress,
    }),
    [
      isActive,
      currentStep,
      completedSteps,
      stepProgress,
      startOnboarding,
      completeStep,
      skipStep,
      goToStep,
      nextStep,
      previousStep,
      finishOnboarding,
      resetOnboarding,
      dismissOnboarding,
      isStepCompleted,
      isStepActive,
      getStepProgress,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextType {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
