/**
 * @packageDocumentation
 * @module SyncPage/animations
 * @description Animation configuration constants for SyncPage component
 */

/**
 * Page-level animation variants for fade in/out transitions
 */
export const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/**
 * Card animation variants with vertical slide and fade
 */
export const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: 0.1,
    },
  },
};

/**
 * Container animation variants for staggered children animations
 */
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

/**
 * Transition configuration for view mode changes
 */
export const viewModeTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.2,
};

/**
 * Simple fade animation variants without size or position changes
 */
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
