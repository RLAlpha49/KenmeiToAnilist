import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Configuration for an element spotlight in the onboarding overlay.
 * @source
 */
export interface ElementSpotlight {
  /** Element ID to spotlight. Takes precedence over selector. */
  elementId?: string;
  /** CSS selector to spotlight. Used if elementId is not provided. */
  selector?: string;
  /** Padding around the element in pixels. Default is 8. */
  padding?: number;
  /** Border radius of the spotlight. Default is 8. */
  borderRadius?: number;
}

/**
 * Calculated position and dimensions of a highlighted element.
 * @source
 */
interface HighlightPosition {
  /** Top offset in pixels. */
  top: number;
  /** Left offset in pixels. */
  left: number;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

/**
 * Props for the OnboardingHighlight component.
 * @source
 */
interface OnboardingHighlightProps {
  /** Whether the highlight is currently active and visible. */
  isActive: boolean;
  /** Spotlight configuration for the element to highlight. */
  spotlight?: ElementSpotlight;
  /** Callback fired when a highlighted action is completed. */
  onActionComplete?: () => void;
}

/**
 * Resolves the DOM element from a spotlight configuration.
 * Prefers elementId over selector for element resolution.
 * @param spotlight - The spotlight configuration.
 * @returns The found HTML element, or null if not found.
 * @source
 */
function resolveElement(
  spotlight: ElementSpotlight | undefined,
): HTMLElement | null {
  if (!spotlight) return null;

  if (spotlight.elementId) {
    return document.getElementById(spotlight.elementId);
  } else if (spotlight.selector) {
    return document.querySelector(spotlight.selector);
  }
  return null;
}

/**
 * Renders a spotlight highlight around a DOM element with animated glow effects.
 * Automatically tracks element position changes and maintains highlight positioning.
 *
 * Features:
 * - Tracks element DOM changes via MutationObserver
 * - Updates position on scroll and resize events
 * - Provides animated glow border and pulsing indicator dot
 * - Displays floating pointer animation above the highlighted element
 * - Handles special cases like sync tab and sync button interactions
 *
 * @source
 */
export function OnboardingHighlight({
  isActive,
  spotlight,
  onActionComplete,
}: Readonly<OnboardingHighlightProps>) {
  const [position, setPosition] = useState<HighlightPosition | null>(null);
  const [currentSpotlight, setCurrentSpotlight] = useState<
    ElementSpotlight | undefined
  >(spotlight);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const attachedElementsRef = useRef<WeakSet<HTMLElement>>(new WeakSet());
  const boundListenersRef = useRef<
    Map<HTMLElement, { listener: (e: Event) => void; useCapture: boolean }>
  >(new Map());

  // Sync tab switching: auto-switch spotlight when sync tab is clicked
  useEffect(() => {
    if (!isActive || !spotlight?.selector?.includes("sync-tab")) {
      setCurrentSpotlight(spotlight);
      return;
    }

    // Listen for sync tab click to switch spotlight to sync settings
    const syncTab = document.querySelector('[data-onboarding="sync-tab"]');
    if (!syncTab) return;

    const handleSyncTabClick = () => {
      // Transition spotlight to sync-settings when sync tab is clicked
      setCurrentSpotlight({
        selector: '[data-onboarding="sync-settings"]',
        padding: 12,
        borderRadius: 8,
      });
    };

    syncTab.addEventListener("click", handleSyncTabClick);
    return () => {
      syncTab.removeEventListener("click", handleSyncTabClick);
    };
  }, [isActive, spotlight]);

  // Dismiss spotlight when sync button is clicked
  useEffect(() => {
    if (!isActive || !currentSpotlight?.selector?.includes("sync-button")) {
      return;
    }

    const syncButton = document.querySelector(
      '[data-onboarding="sync-button"]',
    );
    if (!syncButton || !(syncButton instanceof HTMLElement)) return;

    const handleSyncButtonClick = (e: Event) => {
      // Prevent default behavior and stop propagation
      e.stopPropagation();

      // Clear spotlight on button click
      setPosition(null);
      setCurrentSpotlight(undefined);
      onActionComplete?.();
    };

    // Track attached listeners to prevent duplicate event handlers
    if (!attachedElementsRef.current.has(syncButton)) {
      syncButton.addEventListener("click", handleSyncButtonClick, true);
      attachedElementsRef.current.add(syncButton);
      boundListenersRef.current.set(syncButton, {
        listener: handleSyncButtonClick,
        useCapture: true,
      });
    }

    return () => {
      // Clean up listener only if element still exists in DOM
      if (
        attachedElementsRef.current.has(syncButton) &&
        document.contains(syncButton)
      ) {
        const stored = boundListenersRef.current.get(syncButton);
        if (stored) {
          syncButton.removeEventListener(
            "click",
            stored.listener,
            stored.useCapture,
          );
          boundListenersRef.current.delete(syncButton);
        }
      }
      attachedElementsRef.current = new WeakSet();
    };
  }, [isActive, currentSpotlight, onActionComplete]);

  // Update spotlight when configuration changes
  useEffect(() => {
    // Dismiss spotlight when undefined
    if (!spotlight) {
      setCurrentSpotlight(undefined);
      setPosition(null);
      return;
    }
    // Switch spotlight selector: exit animation, then update
    if (spotlight?.selector !== currentSpotlight?.selector) {
      setPosition(null);
      // Wait for exit animation to complete before updating
      const timeoutId = setTimeout(() => {
        setCurrentSpotlight(spotlight);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [spotlight, currentSpotlight?.selector]);

  // Track element position and DOM changes
  useEffect(() => {
    if (!isActive || !currentSpotlight) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const element = resolveElement(currentSpotlight);

      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = currentSpotlight.padding ?? 8;

        setPosition({
          top: rect.top - padding + window.scrollY,
          left: rect.left - padding + window.scrollX,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
      }
    };

    // Clear spotlight when element is no longer available
    const handleElementNotFound = () => {
      setPosition(null);
      setCurrentSpotlight(undefined);
    };

    // Initial position calculation
    updatePosition();

    let isMounted = true;
    let observerActive = false;

    // Watch for DOM mutations to recompute position on element changes
    const observer = new MutationObserver(() => {
      if (!isMounted) return;

      const element = resolveElement(currentSpotlight);
      if (element) {
        updatePosition();
      } else if (observerActive) {
        // Element was removed from DOM
        handleElementNotFound();
      }
    });

    // Start observing subtree changes on document body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
    observerActive = true;

    // Handle window scroll and resize events
    const handlePositionChange = () => {
      if (!isMounted) return;

      const element = resolveElement(currentSpotlight);
      if (!element) {
        // Element disappeared during scroll/resize
        handleElementNotFound();
        observer.disconnect();
        observerActive = false;
        return;
      }
      updatePosition();
    };

    window.addEventListener("scroll", handlePositionChange, true);
    window.addEventListener("resize", handlePositionChange);

    return () => {
      isMounted = false;
      if (observerActive) {
        observer.disconnect();
      }
      window.removeEventListener("scroll", handlePositionChange, true);
      window.removeEventListener("resize", handlePositionChange);
    };
  }, [isActive, currentSpotlight]);

  return (
    <AnimatePresence>
      {isActive && position && currentSpotlight && (
        <>
          {/* Spotlight cutout with glow */}
          <motion.div
            ref={spotlightRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none fixed z-40"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              height: position.height,
              borderRadius: currentSpotlight.borderRadius ?? 8,
            }}
          >
            {/* Glowing border */}
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(59, 130, 246, 0.2)",
                  "0 0 30px rgba(59, 130, 246, 0.7), inset 0 0 15px rgba(59, 130, 246, 0.3)",
                  "0 0 20px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(59, 130, 246, 0.2)",
                ],
              }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="h-full w-full rounded-[inherit] border-2 border-blue-500"
            />

            {/* Pulsing dot indicator (top-right) */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.6, 1],
              }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-blue-500 shadow-lg"
            />
          </motion.div>

          {/* Floating pointer/arrow - positioned ABOVE element */}
          <motion.div
            animate={{
              y: [0, 8, 0],
            }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            className="pointer-events-none fixed z-40 text-blue-500"
            style={{
              top: position.top - 32,
              left: position.left + position.width / 2,
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-2xl drop-shadow-lg">👇</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
