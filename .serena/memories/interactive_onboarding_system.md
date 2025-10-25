# Interactive Onboarding System

## Overview

The onboarding system has been transformed from a modal-based wizard to an interactive overlay system that guides users through actual app workflows. Users now interact with real features while receiving contextual guidance overlays.

## Architecture

### Core Components

1. **OnboardingContext** (`src/contexts/OnboardingContext.tsx`)
   - Manages onboarding state (active, current step, completed steps)
   - Persists state to storage
   - Provides hooks and methods for step management
   - 7 total steps: welcome, import, auth, matching, settings, sync, complete

2. **OnboardingOverlay** (`src/components/onboarding/OnboardingOverlay.tsx`)
   - Floating card overlay (bottom-right by default)
   - Shows step instructions, progress bar, navigation buttons
   - Non-blocking - users can interact with page behind overlay
   - Auto-dismissible

3. **useOnboardingStep** Hook (`src/hooks/useOnboardingStep.ts`)
   - Simplifies integration for pages
   - Detects if current step is active: `isCurrentStep`
   - Marks step complete: `completeStep()`

## Integration Steps

### For Existing Pages

1. Import the hook:

```tsx
import { useOnboardingStep } from "@/hooks/useOnboardingStep";
```

2. Use in component:

```tsx
const { isCurrentStep, completeStep } = useOnboardingStep("import");
```

3. Call when action completes:

```tsx
const handleImport = async (file: File) => {
  await importData(file);
  completeStep(); // Auto-advances to next step
};
```

4. Optionally show guidance:

```tsx
{
  isCurrentStep && <OnboardingHint text="Upload your CSV file" />;
}
```

## Onboarding Flow

1. **welcome** (Home Page)
   - Introduction to app
   - List of what user will do
   - Manual navigation buttons

2. **import** (Import Page)
   - Instructions to upload CSV
   - Completes when file is successfully imported

3. **auth** (Settings or Home)
   - Authenticate with AniList
   - Completes when token is stored

4. **matching** (Matching/Review Page)
   - Review and approve/reject matches
   - Completes when review is done

5. **settings** (Settings Page)
   - Configure sync preferences
   - Optional step (can be skipped)
   - Completes when settings are accessed

6. **sync** (Sync Page)
   - Execute sync operation
   - Completes when sync finishes

7. **complete** (Any Page)
   - Celebration and completion message
   - Finish button to close onboarding

## Storage

Uses existing STORAGE_KEYS:

- `ONBOARDING_COMPLETED` - Boolean indicating if onboarding is done
- `ONBOARDING_STEPS_COMPLETED` - JSON array of completed step IDs

Users can restart onboarding from home page with "Restart Tour" button.

## Context API

```tsx
const {
  isActive,                    // Is overlay showing
  currentStep,                 // Current step name
  completedSteps,              // Array of completed steps
  stepProgress,                // Object mapping steps to completion

  startOnboarding,             // Start/show overlay
  completeStep(step),          // Mark step complete
  skipStep(step),              // Skip step
  goToStep(step),              // Jump to specific step
  nextStep,                    // Go to next step
  previousStep,                // Go to previous step
  finishOnboarding,            // Complete all and hide
  resetOnboarding,             // Start from beginning
  dismissOnboarding,           // Hide overlay without reset

  isStepCompleted(step),       // Check if step was completed
  isStepActive(step),          // Check if step is current
  getStepProgress,             // Get percentage (0-100)
} = useOnboarding();
```

## Implementation Files

- `src/contexts/OnboardingContext.tsx` - Main context provider
- `src/components/onboarding/OnboardingOverlay.tsx` - Overlay component
- `src/hooks/useOnboardingStep.ts` - Integration hook
- `src/App.tsx` - Provider added to app tree
- `src/pages/HomePage.tsx` - Updated to use context
- `src/utils/storage.ts` - Added storage key

## Non-Blocking Design

The overlay:

- Does not prevent user interaction with page
- Can be dismissed with X button
- Can be skipped with Skip button
- Shows progress visually
- Automatically advances on action completion

## Future Enhancements

1. Add step-specific guidance to each page
2. Implement smooth page transitions during onboarding
3. Add tour restart from any page
4. Highlight relevant UI elements with pointer guides
5. Add keyboard shortcuts (Enter to advance, Esc to skip)
