import React from "react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { cn } from "../../utils/tailwind";

/**
 * Props for the SettingsSectionShell component.
 * @source
 */
interface SettingsSectionShellProps {
  /** Lucide icon component to display in the header. */
  icon: LucideIcon;
  /** Section title. */
  title: string;
  /** Section description or subtitle. */
  description: React.ReactNode;
  /** Tailwind gradient class for the header accent color. */
  accent: string;
  /** Section content. */
  children: React.ReactNode;
  /** Optional badge element to display in the header. */
  badge?: React.ReactNode;
  /** Optional CSS class for the card container. */
  className?: string;
  /** Optional CSS class for the card content area. */
  contentClassName?: string;
  /** Animation delay in seconds. */
  delay?: number;
}

/**
 * Shell component for settings sections with consistent styling and animation.
 * Wraps section content with a card, icon, title, and optional badge.
 * @param props - Component props.
 * @returns The rendered settings section shell.
 * @source
 */
export function SettingsSectionShell({
  icon: Icon,
  title,
  description,
  accent,
  children,
  badge,
  className,
  contentClassName,
  delay = 0,
}: Readonly<SettingsSectionShellProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
    >
      <Card
        className={cn(
          "overflow-hidden border border-slate-200 bg-white/85 !pt-0 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 dark:shadow-[0_30px_80px_-50px_rgba(15,23,42,0.9)]",
          className,
        )}
      >
        <CardHeader
          className={cn(
            "relative overflow-hidden border-b border-slate-200 !py-4 px-6 dark:border-white/10",
            "bg-gradient-to-r",
            accent,
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-white/60 dark:bg-white/5" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-md dark:bg-white/15 dark:text-white dark:shadow-none">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-slate-900 dark:text-white">
                  {title}
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-100/80">
                  {description}
                </CardDescription>
              </div>
            </div>
            {badge && <div className="relative">{badge}</div>}
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "px-6 text-slate-700 dark:text-slate-200",
            contentClassName,
          )}
        >
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}
