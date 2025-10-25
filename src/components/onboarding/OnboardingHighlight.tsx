import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ElementSpotlight {
  elementId?: string;
  selector?: string;
  padding?: number;
  borderRadius?: number;
}

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingHighlightProps {
  isActive: boolean;
  spotlight?: ElementSpotlight;
  onActionComplete?: () => void;
}

/**
 * Resolves the DOM element from a spotlight configuration.
 * Prefers elementId over selector.
 * @param spotlight - The spotlight configuration
 * @returns The found HTML element, or null if not found
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

  // Handle settings step tab switching
  useEffect(() => {
    if (!isActive || !spotlight?.selector?.includes("sync-tab")) {
      setCurrentSpotlight(spotlight);
      return;
    }

    // For the sync tab, listen for when it's clicked to switch spotlight
    const syncTab = document.querySelector('[data-onboarding="sync-tab"]');
    if (!syncTab) return;

    const handleSyncTabClick = () => {
      // Switch to highlighting the sync settings
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

  // Handle sync button click - dismiss spotlight immediately when button is clicked
  useEffect(() => {
    if (!isActive || !currentSpotlight?.selector?.includes("sync-button")) {
      return;
    }

    const syncButton = document.querySelector(
      '[data-onboarding="sync-button"]',
    );
    if (!syncButton || !(syncButton instanceof HTMLElement)) return;

    const handleSyncButtonClick = (e: Event) => {
      // Prevent any potential issues with the click propagation
      e.stopPropagation();

      // Clear the spotlight immediately when sync button is clicked
      setPosition(null);
      setCurrentSpotlight(undefined);
      onActionComplete?.();
    };

    // Guard: only attach listener if not already attached to this element
    if (!attachedElementsRef.current.has(syncButton)) {
      syncButton.addEventListener("click", handleSyncButtonClick, true);
      attachedElementsRef.current.add(syncButton);
      boundListenersRef.current.set(syncButton, {
        listener: handleSyncButtonClick,
        useCapture: true,
      });
    }

    return () => {
      // Clean up listener if this exact element instance still exists
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

  // Sync current spotlight state prop
  useEffect(() => {
    // Clear spotlight when it becomes undefined
    if (!spotlight) {
      setCurrentSpotlight(undefined);
      setPosition(null);
      return;
    }
    // When spotlight selector changes, clear position immediately to trigger exit animation
    if (spotlight?.selector !== currentSpotlight?.selector) {
      setPosition(null);
      // Use setTimeout to ensure animation completes before updating spotlight
      const timeoutId = setTimeout(() => {
        setCurrentSpotlight(spotlight);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [spotlight, currentSpotlight?.selector]);

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

    // Helper to handle when element is no longer available
    const handleElementNotFound = () => {
      setPosition(null);
      setCurrentSpotlight(undefined);
    };

    // Update position immediately
    updatePosition();

    let isMounted = true;
    let observerActive = false;

    // Use MutationObserver to watch for DOM changes (element additions/removals)
    const observer = new MutationObserver(() => {
      if (!isMounted) return;

      // Recompute spotlight position if DOM subtree changed
      const element = resolveElement(currentSpotlight);
      if (element) {
        updatePosition();
      } else if (observerActive) {
        // Element was removed, clear spotlight
        handleElementNotFound();
      }
    });

    // Start observing document.body for subtree changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
    observerActive = true;

    // Also update on scroll and resize
    const handlePositionChange = () => {
      if (!isMounted) return;

      const element = resolveElement(currentSpotlight);
      if (!element) {
        // Element disappeared, remove spotlight
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
