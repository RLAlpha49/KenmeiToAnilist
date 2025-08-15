import React from "react";
import {
  AlertCircle,
  WifiOff,
  Lock,
  Server,
  Ban,
  Monitor,
  HardDrive,
  Cpu,
} from "lucide-react";
import { ErrorType } from "../../utils/errorHandling";

interface ErrorMessageProps {
  message: string;
  type?: ErrorType;
  retry?: () => void;
  dismiss?: () => void;
  showTypeLabel?: boolean;
}

type TypeConfig = {
  icon: React.ReactNode;
  classes: string;
  label: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  unknown: {
    icon: <AlertCircle className="h-5 w-5" />,
    classes:
      "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
    label: "Unknown",
  },
  validation: {
    icon: <Ban className="h-5 w-5" />,
    classes:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    label: "Validation",
  },
  network: {
    icon: <WifiOff className="h-5 w-5" />,
    classes:
      "bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    label: "Network",
  },
  auth: {
    icon: <Lock className="h-5 w-5" />,
    classes:
      "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    label: "Auth",
  },
  server: {
    icon: <Server className="h-5 w-5" />,
    classes:
      "bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    label: "Server",
  },
  client: {
    icon: <Monitor className="h-5 w-5" />,
    classes:
      "bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-300 border-gray-200 dark:border-gray-800",
    label: "Client",
  },
  storage: {
    icon: <HardDrive className="h-5 w-5" />,
    classes:
      "bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    label: "Storage",
  },
  AUTHENTICATION: {
    icon: <Lock className="h-5 w-5" />,
    classes:
      "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    label: "Authentication",
  },
  SYSTEM: {
    icon: <Cpu className="h-5 w-5" />,
    classes:
      "bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800",
    label: "System",
  },
};

export function ErrorMessage({
  message,
  type = ErrorType.UNKNOWN,
  retry,
  dismiss,
  showTypeLabel = true,
}: ErrorMessageProps) {
  const cfg =
    TYPE_CONFIG[type] ??
    TYPE_CONFIG[ErrorType.UNKNOWN] ??
    TYPE_CONFIG["unknown"];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${cfg.classes}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="shrink-0 pt-0.5" aria-hidden="true">
        {cfg.icon}
      </div>
      <div className="flex-1">
        <p className="mb-1 font-medium">
          {showTypeLabel && (
            <span className="mr-1 inline-block rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase dark:bg-white/10">
              {cfg.label}
            </span>
          )}
          {message}
        </p>
        {(retry || dismiss) && (
          <div className="mt-2 flex gap-3">
            {retry && (
              <button
                onClick={retry}
                className="rounded bg-white px-2 py-1 text-xs font-medium shadow-sm ring-1 ring-black/10 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-800 dark:ring-white/10 dark:hover:bg-gray-700"
              >
                Try Again
              </button>
            )}
            {dismiss && (
              <button
                onClick={dismiss}
                className="rounded px-2 py-1 text-xs font-medium hover:bg-white/20 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:hover:bg-black/20"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
