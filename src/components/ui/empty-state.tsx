import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

/**
 * Color scheme variants for empty states.
 * @source
 */
const colorSchemes = {
  default: {
    background: "bg-blue-100 dark:bg-blue-900/30",
    icon: "text-blue-600 dark:text-blue-400",
    button:
      "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
  },
  info: {
    background: "bg-slate-100 dark:bg-slate-900/30",
    icon: "text-slate-600 dark:text-slate-400",
    button:
      "bg-gradient-to-r from-slate-600 to-gray-600 hover:from-slate-700 hover:to-gray-700",
  },
  warning: {
    background: "bg-amber-100 dark:bg-amber-900/30",
    icon: "text-amber-600 dark:text-amber-400",
    button:
      "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700",
  },
  success: {
    background: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: "text-emerald-600 dark:text-emerald-400",
    button:
      "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700",
  },
};

/**
 * Props for the EmptyState component.
 * @property icon - React node to display as the icon.
 * @property title - Title text for the empty state.
 * @property description - Description text for the empty state.
 * @property actionLabel - Optional label for the action button.
 * @property onAction - Optional callback when action button is clicked.
 * @property variant - Color scheme variant (default: "default").
 * @source
 */
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "info" | "warning" | "success";
}

/**
 * Reusable empty state component for displaying empty/no-data states.
 * Displays a centered layout with icon, title, description, and optional action button.
 * Supports multiple color scheme variants with smooth animations.
 * @param props - The component props.
 * @returns The rendered empty state.
 * @source
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
}: Readonly<EmptyStateProps>) {
  const colors = colorSchemes[variant];

  return (
    <motion.div
      className="bg-background/50 flex h-full min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-12 text-center backdrop-blur-sm dark:border-gray-700"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      role="output"
      aria-label={title}
    >
      <motion.div
        className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${colors.background}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.3,
          type: "spring",
          stiffness: 200,
          damping: 20,
        }}
      >
        <div className={`h-10 w-10 ${colors.icon}`}>{icon}</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <h3 className="mb-2 text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground mb-6 text-sm">{description}</p>
        {actionLabel && onAction && (
          <Button className={colors.button} onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
